import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { findTask } from "#api/tasks/lib/find-task";
import { taskTable } from "#api/tasks/tables";

/**
 * Archives a task or brings it back. The task keeps its column and position,
 * so unarchiving puts it exactly where it was. Not part of the activity feed;
 * it is part of the task's history.
 */
export async function setTaskArchived(
  workspaceId: string,
  projectId: string,
  taskId: string,
  archived: boolean,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    await tx
      .update(taskTable)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(taskTable.id, taskId));
    if ((task.archivedAt !== null) !== archived) {
      await recordTaskEvent(tx, projectId, taskId, {
        type: archived ? "archived" : "unarchived",
        data: {},
      });
    }
  });
  return { txid };
}
