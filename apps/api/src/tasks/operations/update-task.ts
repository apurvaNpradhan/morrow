import type { TaskPriority } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { assertAssignable, type TaskActor } from "#api/tasks/lib/assignee";
import { saveDescription } from "#api/tasks/lib/description";
import { findTask } from "#api/tasks/lib/find-task";
import { personRef } from "#api/tasks/history/person-ref";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { taskDescriptionTable, taskTable } from "#api/tasks/tables";

/** One group of fields; each field group has its own Procedure. */
export type TaskPatch = {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
};

/**
 * Writes only the fields in `patch`, so two people editing different fields of
 * one task never overwrite each other. Archived tasks stay editable; a task of
 * an archived Project does not. A field that really changed is recorded in the
 * task's history.
 */
export async function updateTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  actor: TaskActor,
  patch: TaskPatch,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    if (patch.assigneeId !== undefined) {
      await assertAssignable(
        tx,
        workspaceId,
        actor,
        patch.assigneeId,
        task.assigneeId,
      );
    }
    const { description, ...fields } = patch;
    const [previous] =
      description === undefined
        ? []
        : await tx
            .select({ description: taskDescriptionTable.description })
            .from(taskDescriptionTable)
            .where(eq(taskDescriptionTable.taskId, taskId));
    // `updatedAt` always changes, so the write reaches sync even when the
    // value did not.
    await tx
      .update(taskTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(taskTable.id, taskId));
    if (description !== undefined) {
      await saveDescription(tx, projectId, taskId, description);
    }

    const record = (event: Parameters<typeof recordTaskEvent>[3]) =>
      recordTaskEvent(tx, projectId, taskId, event);
    if (patch.title !== undefined && patch.title !== task.title) {
      await record({
        type: "title",
        data: { from: task.title, to: patch.title },
      });
    }
    if (patch.priority !== undefined && patch.priority !== task.priority) {
      await record({
        type: "priority",
        data: { from: task.priority, to: patch.priority },
      });
    }
    if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate) {
      await record({
        type: "due_date",
        data: { from: task.dueDate, to: patch.dueDate },
      });
    }
    if (
      patch.assigneeId !== undefined &&
      patch.assigneeId !== task.assigneeId
    ) {
      await record({
        type: "assignee",
        data: {
          from: await personRef(tx, task.assigneeId),
          to: await personRef(tx, patch.assigneeId),
        },
      });
    }
    if (
      description !== undefined &&
      description !== (previous?.description ?? "")
    ) {
      await record({ type: "description", data: {} });
    }
  });
  return { txid };
}
