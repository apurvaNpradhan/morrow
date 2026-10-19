import { and, eq, inArray } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

/**
 * Deletes many Tasks of one Project in a single transaction and records each
 * in the activity feed. Ids that are no longer Tasks of the Project are
 * skipped and counted.
 */
export async function bulkRemoveTasks(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
) {
  const { result, txid } = await withTxid(async (tx) => {
    const project = await lockProject(tx, workspaceId, projectId);
    const ids = [...new Set(taskIds)];
    const tasks = await tx
      .select()
      .from(taskTable)
      .where(
        and(eq(taskTable.projectId, projectId), inArray(taskTable.id, ids)),
      );
    if (tasks.length > 0) {
      await tx.delete(taskTable).where(
        inArray(
          taskTable.id,
          tasks.map((task) => task.id),
        ),
      );
    }
    for (const task of tasks) {
      await recordTaskActivity(tx, "task.deleted", workspaceId, project, task);
    }
    return { skipped: ids.length - tasks.length };
  });
  return { txid, skipped: result.skipped };
}
