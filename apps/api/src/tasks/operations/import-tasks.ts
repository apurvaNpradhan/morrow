import { createId } from "@paralleldrive/cuid2";
import {
  COLUMN_COLORS,
  type ColumnColor,
  compareColumns,
  isClosedCategory,
  LABEL_NAME_MAX,
  MAX_TASK_LABELS,
  normalizeLabelName,
} from "@morrow/sync-schemas";
import { eq, max, sql } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { labelTable } from "#api/labels/index";
import { schema } from "#api/platform/database/index";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  lockProject,
  projectColumnTable,
  projectTable,
} from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import type { TaskActor } from "#api/tasks/lib/assignee";
import { checklistColumns } from "#api/tasks/lib/description";
import {
  importDocument,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_TASKS,
} from "#api/tasks/lib/import-document";
import { matchColumn } from "#api/tasks/lib/match-column";
import type { ImportWarning } from "#api/tasks/response";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskEventTable,
  taskTable,
} from "#api/tasks/tables";

/** Rows per insert: a task has 17 bound columns and Postgres allows 65,535 parameters. */
const INSERT_CHUNK = 1000;

/**
 * Imports tasks from an export document into a project, all or nothing. Tasks
 * get new numbers (in the file's numbering order) and land at the end of their
 * column in file order. Columns match by name, then category; assignees and
 * comment authors match Members by email; labels match by name ignoring case,
 * and are created when the actor may create labels, else dropped. Comments keep
 * their times. Every task gets one `imported` history entry. Whatever could not
 * be matched is reported, not refused.
 */
export async function importTasks(
  workspaceId: string,
  projectId: string,
  actor: TaskActor & { canCreateLabels: boolean },
  rawDocument: unknown,
) {
  if (Buffer.byteLength(JSON.stringify(rawDocument) ?? "") > MAX_IMPORT_BYTES) {
    throw taskError("IMPORT_TOO_LARGE");
  }
  const parsed = importDocument.safeParse(rawDocument);
  if (!parsed.success) throw taskError("IMPORT_INVALID");
  const document = parsed.data;
  if (document.tasks.length > MAX_IMPORT_TASKS) {
    throw taskError("IMPORT_TOO_LARGE");
  }

  const { result, txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const warnings: ImportWarning[] = [];
    if (document.tasks.length === 0) return { created: 0, warnings };

    const columns = (
      await tx
        .select()
        .from(projectColumnTable)
        .where(eq(projectColumnTable.projectId, projectId))
    ).sort(compareColumns);

    // Assignees: Members by email, and only those the actor may assign.
    const members = await tx
      .select({ id: schema.userTable.id, email: schema.userTable.email })
      .from(schema.workspaceUserTable)
      .innerJoin(
        schema.userTable,
        eq(schema.userTable.id, schema.workspaceUserTable.userId),
      )
      .where(eq(schema.workspaceUserTable.workspaceId, workspaceId));
    const memberByEmail = new Map(
      members.map((member) => [member.email.toLowerCase(), member.id]),
    );
    const unknownEmails = new Map<string, number>();
    let dropped = 0;
    const assigneeFor = (email: string | null) => {
      if (!email) return null;
      const id = memberByEmail.get(email.toLowerCase());
      if (!id) {
        unknownEmails.set(email, (unknownEmails.get(email) ?? 0) + 1);
        return null;
      }
      if (!actor.canAssign && id !== actor.userId) {
        dropped += 1;
        return null;
      }
      return id;
    };

    // Labels: the Workspace's, by name ignoring case. Names it lacks are
    // created when the actor may create labels, in the file's colour.
    const existingLabels = await tx
      .select()
      .from(labelTable)
      .where(eq(labelTable.workspaceId, workspaceId));
    const labelIdByName = new Map(
      existingLabels.map((label) => [normalizeLabelName(label.name), label.id]),
    );
    const colorByName = new Map(
      document.labels.map((label) => [
        normalizeLabelName(label.name),
        label.color,
      ]),
    );
    const missing = new Map<string, string>();
    for (const task of document.tasks) {
      for (const raw of task.labels) {
        const name = raw.trim();
        const key = normalizeLabelName(name);
        if (key !== "" && name.length <= LABEL_NAME_MAX) {
          if (!labelIdByName.has(key) && !missing.has(key))
            missing.set(key, name);
        }
      }
    }
    const droppedLabels = new Map<string, number>();
    if (actor.canCreateLabels && missing.size > 0) {
      const [last] = await tx
        .select({ position: max(labelTable.position) })
        .from(labelTable)
        .where(eq(labelTable.workspaceId, workspaceId));
      const positions = generateNKeysBetween(
        last?.position ?? null,
        null,
        missing.size,
      );
      const created = [...missing].map(([key, name], at) => {
        const wanted = colorByName.get(key);
        return {
          id: createId(),
          workspaceId,
          name,
          color: (COLUMN_COLORS as readonly string[]).includes(wanted ?? "")
            ? (wanted as ColumnColor)
            : COLUMN_COLORS[
                (existingLabels.length + at) % COLUMN_COLORS.length
              ]!,
          position: positions[at]!,
        };
      });
      await tx.insert(labelTable).values(created);
      for (const label of created) {
        labelIdByName.set(normalizeLabelName(label.name), label.id);
      }
    }
    const labelIdsFor = (names: string[]) => {
      const ids = new Set<string>();
      for (const raw of names) {
        const name = raw.trim();
        const id = labelIdByName.get(normalizeLabelName(name));
        if (id) ids.add(id);
        else if (name !== "") {
          droppedLabels.set(name, (droppedLabels.get(name) ?? 0) + 1);
        }
      }
      return [...ids].slice(0, MAX_TASK_LABELS);
    };

    // Comment authors: Members by email; anyone else is "Deleted user".
    const unknownAuthors = new Map<string, number>();
    const commentsFor = (task: (typeof document.tasks)[number]) =>
      task.comments.flatMap((comment) => {
        const body = comment.body.trim();
        if (body === "") return [];
        const authorId = comment.authorEmail
          ? (memberByEmail.get(comment.authorEmail.toLowerCase()) ?? null)
          : null;
        if (comment.authorEmail && authorId === null) {
          unknownAuthors.set(
            comment.authorEmail,
            (unknownAuthors.get(comment.authorEmail) ?? 0) + 1,
          );
        }
        return [{ ...comment, body, authorId }];
      });

    const unmatched = new Map<string, { usedColumn: string; count: number }>();
    const placed = document.tasks.map((task, index) => {
      const { column, exact } = matchColumn(
        columns,
        { column: task.column, category: task.category },
        document.columns,
      );
      if (!exact) {
        const known = unmatched.get(task.column);
        unmatched.set(task.column, {
          usedColumn: column.name,
          count: (known?.count ?? 0) + 1,
        });
      }
      return {
        task,
        column,
        index,
        assigneeId: assigneeFor(task.assigneeEmail),
        labelIds: labelIdsFor(task.labels),
        comments: commentsFor(task),
      };
    });

    // Positions: appended after what each column already holds, in file order.
    const positionOf = new Map<number, string>();
    for (const column of columns) {
      const inColumn = placed.filter((entry) => entry.column.id === column.id);
      if (inColumn.length === 0) continue;
      const [last] = await tx
        .select({ position: max(taskTable.position) })
        .from(taskTable)
        .where(eq(taskTable.columnId, column.id));
      const keys = generateNKeysBetween(
        last?.position ?? null,
        null,
        inColumn.length,
      );
      for (const [at, entry] of inColumn.entries()) {
        positionOf.set(entry.index, keys[at]!);
      }
    }

    // Numbers: one block from the project's counter, handed out in the file's
    // own numbering order so relative order survives.
    const [counter] = await tx
      .update(projectTable)
      .set({
        lastTaskNumber: sql`${projectTable.lastTaskNumber} + ${placed.length}`,
      })
      .where(eq(projectTable.id, projectId))
      .returning({ last: projectTable.lastTaskNumber });
    if (!counter) throw new Error("Project counter returned no row");
    const first = counter.last - placed.length + 1;
    const numberOf = new Map(
      [...placed]
        .sort((a, b) => a.task.number - b.task.number || a.index - b.index)
        .map((entry, at) => [entry.index, first + at]),
    );

    const now = new Date();
    const rows = placed.map(
      ({ task, column, index, assigneeId, labelIds, comments }) => ({
        id: createId(),
        projectId,
        columnId: column.id,
        number: numberOf.get(index)!,
        title: task.title,
        ...checklistColumns(task.description),
        priority: task.priority,
        assigneeId,
        dueDate: task.dueDate,
        labelIds,
        commentCount: comments.length,
        position: positionOf.get(index)!,
        completedAt: isClosedCategory(column.category)
          ? (task.completedAt ?? now)
          : null,
        archivedAt: task.archivedAt,
        createdBy: actor.userId,
        createdAt: task.createdAt ?? now,
      }),
    );
    for (let at = 0; at < rows.length; at += INSERT_CHUNK) {
      await tx.insert(taskTable).values(rows.slice(at, at + INSERT_CHUNK));
    }
    const descriptions = rows.map((row, at) => ({
      taskId: row.id,
      projectId,
      description: placed[at]!.task.description,
    }));
    for (let at = 0; at < descriptions.length; at += INSERT_CHUNK) {
      await tx
        .insert(taskDescriptionTable)
        .values(descriptions.slice(at, at + INSERT_CHUNK));
    }

    const commentRows = rows.flatMap((row, at) =>
      placed[at]!.comments.map((comment) => ({
        id: createId(),
        taskId: row.id,
        projectId,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment.createdAt ?? now,
        editedAt: comment.editedAt,
        updatedAt: comment.editedAt ?? comment.createdAt ?? now,
      })),
    );
    for (let at = 0; at < commentRows.length; at += INSERT_CHUNK) {
      await tx
        .insert(taskCommentTable)
        .values(commentRows.slice(at, at + INSERT_CHUNK));
    }
    const events = rows.map((row) => ({
      taskId: row.id,
      projectId,
      actorId: actor.userId,
      type: "imported",
      data: {},
      createdAt: now,
      updatedAt: now,
    }));
    for (let at = 0; at < events.length; at += INSERT_CHUNK) {
      await tx
        .insert(taskEventTable)
        .values(events.slice(at, at + INSERT_CHUNK));
    }

    for (const [column, { usedColumn, count }] of unmatched) {
      warnings.push({ kind: "column_unmatched", column, usedColumn, count });
    }
    for (const [email, count] of unknownEmails) {
      warnings.push({ kind: "assignee_unknown", email, count });
    }
    if (dropped > 0)
      warnings.push({ kind: "assignee_dropped", count: dropped });
    for (const [label, count] of droppedLabels) {
      warnings.push({ kind: "label_dropped", label, count });
    }
    for (const [email, count] of unknownAuthors) {
      warnings.push({ kind: "comment_author_unknown", email, count });
    }
    return { created: rows.length, warnings };
  });
  return { ...result, txid };
}
