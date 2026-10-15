import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { findTask } from "#api/tasks/lib/find-task";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

/** Deletes a task and records it in the activity feed. */
export async function deleteTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    const project = await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    await tx.delete(taskTable).where(eq(taskTable.id, taskId));
    await recordTaskActivity(tx, "task.deleted", workspaceId, project, task);
  });
  return { txid };
}
