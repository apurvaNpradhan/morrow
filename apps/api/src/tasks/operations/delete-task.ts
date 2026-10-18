import { ticketId } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { findTask } from "#api/tasks/lib/find-task";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
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
    if (task.parentId) {
      // The deleted task's own history goes with it; the parent keeps its.
      await refreshSubtaskCounts(tx, [task.parentId]);
      await recordTaskEvent(tx, projectId, task.parentId, {
        type: "subtask_removed",
        data: { ticketId: ticketId(project.key, task.number) },
      });
    }
    await recordTaskActivity(tx, "task.deleted", workspaceId, project, task);
  });
  return { txid };
}
