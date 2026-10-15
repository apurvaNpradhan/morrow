import { createId } from "@paralleldrive/cuid2";
import { compareColumns, isClosedCategory } from "@morrow/sync-schemas";
import { eq, max, sql } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { schema } from "#api/platform/database/index";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  lockProject,
  projectColumnTable,
  projectTable,
} from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import type { TaskActor } from "#api/tasks/lib/assignee";
import {
  importDocument,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_TASKS,
} from "#api/tasks/lib/import-document";
import { matchColumn } from "#api/tasks/lib/match-column";
import type { ImportWarning } from "#api/tasks/response";
import { taskTable } from "#api/tasks/tables";

/** Rows per insert: a task has 12 bound columns and Postgres allows 65,535 parameters. */
const INSERT_CHUNK = 1000;

/**
 * Imports tasks from an export document into a project, all or nothing. Tasks
 * get new numbers (in the file's numbering order) and land at the end of their
 * column in file order. Columns match by name, then category; assignees match
 * Members by email. Whatever could not be matched is reported, not refused.
 */
export async function importTasks(
  workspaceId: string,
  projectId: string,
  actor: TaskActor,
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
    const rows = placed.map(({ task, column, index, assigneeId }) => ({
      id: createId(),
      projectId,
      columnId: column.id,
      number: numberOf.get(index)!,
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigneeId,
      dueDate: task.dueDate,
      position: positionOf.get(index)!,
      completedAt: isClosedCategory(column.category)
        ? (task.completedAt ?? now)
        : null,
      archivedAt: task.archivedAt,
      createdBy: actor.userId,
      createdAt: task.createdAt ?? now,
    }));
    for (let at = 0; at < rows.length; at += INSERT_CHUNK) {
      await tx.insert(taskTable).values(rows.slice(at, at + INSERT_CHUNK));
    }

    for (const [column, { usedColumn, count }] of unmatched) {
      warnings.push({ kind: "column_unmatched", column, usedColumn, count });
    }
    for (const [email, count] of unknownEmails) {
      warnings.push({ kind: "assignee_unknown", email, count });
    }
    if (dropped > 0)
      warnings.push({ kind: "assignee_dropped", count: dropped });
    return { created: rows.length, warnings };
  });
  return { ...result, txid };
}
