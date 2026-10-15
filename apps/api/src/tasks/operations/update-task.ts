import type { TaskPriority } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { assertAssignable, type TaskActor } from "#api/tasks/lib/assignee";
import { checklistColumns, saveDescription } from "#api/tasks/lib/description";
import { findTask } from "#api/tasks/lib/find-task";
import { taskTable } from "#api/tasks/tables";

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
 * an archived Project does not.
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
    // `updatedAt` always changes, so the write reaches sync even when the
    // value did not.
    await tx
      .update(taskTable)
      .set(
        description === undefined
          ? fields
          : { ...fields, ...checklistColumns(description) },
      )
      .where(eq(taskTable.id, taskId));
    if (description !== undefined) {
      await saveDescription(tx, projectId, taskId, description);
    }
  });
  return { txid };
}
