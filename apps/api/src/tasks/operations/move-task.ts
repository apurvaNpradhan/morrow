import { nextCompletedAt } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  assertValidPosition,
  findColumn,
  lockProject,
} from "#api/projects/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { freePosition } from "#api/tasks/lib/free-position";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

/**
 * Puts a task at a position the client computed among the tasks of the target
 * column. Entering a done or canceled column stamps it completed (and records
 * it); leaving one clears that. A slot that is already held (two people landing
 * on the same spot, or an archived task the browser cannot see) is resolved by
 * `freePosition`, so a move never fails for it.
 */
export async function moveTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  target: { columnId: string; position: string },
) {
  assertValidPosition(target.position);
  try {
    const { txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      const task = await findTask(tx, projectId, taskId);
      const to = await findColumn(tx, projectId, target.columnId).catch(() => {
        throw taskError("COLUMN_NOT_IN_PROJECT");
      });
      const from = await findColumn(tx, projectId, task.columnId);
      await tx
        .update(taskTable)
        .set({
          columnId: to.id,
          position: await freePosition(tx, to.id, target.position, taskId),
          completedAt: nextCompletedAt(
            task.completedAt,
            from.category,
            to.category,
            new Date(),
          ),
        })
        .where(eq(taskTable.id, taskId));
      if (from.category !== to.category) {
        if (to.category === "done" || to.category === "canceled") {
          await recordTaskActivity(
            tx,
            to.category === "done" ? "task.completed" : "task.canceled",
            workspaceId,
            project,
            task,
          );
        }
      }
    });
    return { txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
