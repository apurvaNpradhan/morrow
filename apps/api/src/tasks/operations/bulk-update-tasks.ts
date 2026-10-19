import {
  MAX_TASK_LABELS,
  nextCompletedAt,
  type TaskPriority,
} from "@morrow/sync-schemas";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { generateNKeysBetween } from "fractional-indexing";
import { findLabel, labelError } from "#api/labels/index";
import type { DbOrTx } from "#api/members/index";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  findColumn,
  lockProject,
  projectColumnTable,
} from "#api/projects/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { personRef } from "#api/tasks/history/person-ref";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { assertAssignable, type TaskActor } from "#api/tasks/lib/assignee";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

/** What one bulk action does to every Task it names. */
export type BulkChange =
  | { type: "move"; columnId: string }
  | { type: "priority"; priority: TaskPriority }
  | { type: "assignee"; assigneeId: string | null }
  | { type: "dueDate"; dueDate: string | null }
  | { type: "addLabel"; labelId: string }
  | { type: "removeLabel"; labelId: string }
  | { type: "archive"; archived: boolean };

type Task = typeof taskTable.$inferSelect;

/**
 * Applies one change to many Tasks of one Project in a single transaction:
 * either every Task changes or none does. Ids that are no longer Tasks of the
 * Project (deleted or moved away meanwhile) are skipped and counted, so one
 * concurrent delete does not fail the batch. Each Task whose value really
 * changed gets the history entry a single edit would record.
 */
export async function bulkUpdateTasks(
  workspaceId: string,
  projectId: string,
  actor: TaskActor,
  taskIds: string[],
  change: BulkChange,
) {
  try {
    const { result, txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      const ids = [...new Set(taskIds)];
      const found = await tx
        .select()
        .from(taskTable)
        .where(
          and(eq(taskTable.projectId, projectId), inArray(taskTable.id, ids)),
        );
      const byId = new Map(found.map((task) => [task.id, task]));
      // View order matters to `move`, so the tasks keep the order of `ids`.
      const tasks = ids.flatMap((id) => byId.get(id) ?? []);

      const record = (
        task: Task,
        event: Parameters<typeof recordTaskEvent>[3],
      ) => recordTaskEvent(tx, projectId, task.id, event);
      const update = (set: PgUpdateSetSource<typeof taskTable>, of: Task[]) =>
        of.length === 0
          ? undefined
          : tx
              .update(taskTable)
              .set(set)
              .where(
                inArray(
                  taskTable.id,
                  of.map((task) => task.id),
                ),
              );

      switch (change.type) {
        case "move":
          await moveTasks(
            tx,
            workspaceId,
            project,
            projectId,
            tasks,
            change.columnId,
          );
          break;
        case "priority":
          await update({ priority: change.priority }, tasks);
          for (const task of tasks) {
            if (task.priority === change.priority) continue;
            await record(task, {
              type: "priority",
              data: { from: task.priority, to: change.priority },
            });
          }
          break;
        case "dueDate":
          await update({ dueDate: change.dueDate }, tasks);
          for (const task of tasks) {
            if (task.dueDate === change.dueDate) continue;
            await record(task, {
              type: "due_date",
              data: { from: task.dueDate, to: change.dueDate },
            });
          }
          break;
        case "assignee": {
          for (const current of new Set(tasks.map((task) => task.assigneeId))) {
            await assertAssignable(
              tx,
              workspaceId,
              actor,
              change.assigneeId,
              current,
            );
          }
          await update({ assigneeId: change.assigneeId }, tasks);
          const to = await personRef(tx, change.assigneeId);
          for (const task of tasks) {
            if (task.assigneeId === change.assigneeId) continue;
            await record(task, {
              type: "assignee",
              data: { from: await personRef(tx, task.assigneeId), to },
            });
          }
          break;
        }
        case "addLabel":
        case "removeLabel": {
          const applied = change.type === "addLabel";
          const { labelId } = change;
          const label = applied
            ? await findLabel(tx, workspaceId, labelId, "share")
            : await findLabel(tx, workspaceId, labelId).catch(() => undefined);
          if (
            applied &&
            tasks.some(
              (task) =>
                !task.labelIds.includes(labelId) &&
                task.labelIds.length >= MAX_TASK_LABELS,
            )
          ) {
            throw labelError("LABEL_LIMIT_REACHED");
          }
          await update(
            {
              labelIds: applied
                ? sql`CASE WHEN ${labelId} = ANY(${taskTable.labelIds}) THEN ${taskTable.labelIds} ELSE array_append(${taskTable.labelIds}, ${labelId}) END`
                : sql`array_remove(${taskTable.labelIds}, ${labelId})`,
            },
            tasks,
          );
          if (!label) break;
          const ref = { id: label.id, name: label.name, color: label.color };
          for (const task of tasks) {
            if (task.labelIds.includes(labelId) === applied) continue;
            await record(task, {
              type: "labels",
              data: applied
                ? { added: [ref], removed: [] }
                : { added: [], removed: [ref] },
            });
          }
          break;
        }
        case "archive": {
          // Archiving leaves already archived Tasks (and their date) alone.
          const changing = tasks.filter(
            (task) => (task.archivedAt !== null) !== change.archived,
          );
          await update(
            { archivedAt: change.archived ? new Date() : null },
            changing,
          );
          for (const task of changing) {
            await record(task, {
              type: change.archived ? "archived" : "unarchived",
              data: {},
            });
          }
          break;
        }
      }
      return { skipped: ids.length - tasks.length };
    });
    return { txid, skipped: result.skipped };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}

/**
 * Appends the Tasks to the end of the target Column in the order given, after
 * every position the Column holds (archived Tasks included, so slots never
 * collide). Tasks already in the Column stay where they are.
 */
async function moveTasks(
  tx: DbOrTx,
  workspaceId: string,
  project: { id: string; key: string },
  projectId: string,
  tasks: Task[],
  columnId: string,
) {
  const to = await findColumn(tx, projectId, columnId).catch(() => {
    throw taskError("COLUMN_NOT_IN_PROJECT");
  });
  const moving = tasks.filter((task) => task.columnId !== to.id);
  if (moving.length === 0) return;
  const columns = new Map(
    (
      await tx
        .select()
        .from(projectColumnTable)
        .where(eq(projectColumnTable.projectId, projectId))
    ).map((column) => [column.id, column]),
  );
  const [last] = await tx
    .select({ position: taskTable.position })
    .from(taskTable)
    .where(eq(taskTable.columnId, to.id))
    .orderBy(desc(taskTable.position))
    .limit(1);
  const positions = generateNKeysBetween(
    last?.position ?? null,
    null,
    moving.length,
  );
  const now = new Date();
  const ref = ({
    id,
    name,
    category,
  }: typeof projectColumnTable.$inferSelect) => ({
    id,
    name,
    category,
  });
  for (const [index, task] of moving.entries()) {
    const from = columns.get(task.columnId);
    if (!from) continue;
    await tx
      .update(taskTable)
      .set({
        columnId: to.id,
        position: positions[index]!,
        completedAt: nextCompletedAt(
          task.completedAt,
          from.category,
          to.category,
          now,
        ),
      })
      .where(eq(taskTable.id, task.id));
    await recordTaskEvent(tx, projectId, task.id, {
      type: "column",
      data: { from: ref(from), to: ref(to) },
    });
    if (
      from.category !== to.category &&
      (to.category === "done" || to.category === "canceled")
    ) {
      await recordTaskActivity(
        tx,
        to.category === "done" ? "task.completed" : "task.canceled",
        workspaceId,
        project,
        task,
      );
    }
  }
}
