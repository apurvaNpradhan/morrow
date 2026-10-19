import { nextCompletedAt } from "@morrow/sync-schemas";
import { asc, eq, max } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectColumnTable } from "#api/projects/tables";
import {
  refreshBlockedCounts,
  refreshSubtaskCounts,
  taskTable,
} from "#api/tasks/index";
import { findColumn } from "../lib/find-column";
import { assertNotLastRequiredColumn } from "../lib/required-columns";

/**
 * Deletes a column. Its tasks move to the end of `targetColumnId` in the same
 * transaction, in their existing order and with their completion brought in
 * line with the target's category, so nothing is lost and nobody has to empty
 * the column by hand.
 */
export async function deleteColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
  targetColumnId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const column = await findColumn(tx, projectId, columnId);
    if (targetColumnId === columnId) {
      throw projectError("INVALID_TARGET_COLUMN");
    }
    // A target outside this project is as good as no target.
    const target = await findColumn(tx, projectId, targetColumnId).catch(() => {
      throw projectError("INVALID_TARGET_COLUMN");
    });
    await assertNotLastRequiredColumn(tx, projectId, column);

    const tasks = await tx
      .select({
        id: taskTable.id,
        parentId: taskTable.parentId,
        completedAt: taskTable.completedAt,
      })
      .from(taskTable)
      .where(eq(taskTable.columnId, columnId))
      .orderBy(asc(taskTable.position));
    if (tasks.length > 0) {
      const [last] = await tx
        .select({ position: max(taskTable.position) })
        .from(taskTable)
        .where(eq(taskTable.columnId, targetColumnId));
      const positions = generateNKeysBetween(
        last?.position ?? null,
        null,
        tasks.length,
      );
      const now = new Date();
      for (const [index, task] of tasks.entries()) {
        await tx
          .update(taskTable)
          .set({
            columnId: targetColumnId,
            position: positions[index],
            completedAt: nextCompletedAt(
              task.completedAt,
              column.category,
              target.category,
              now,
            ),
          })
          .where(eq(taskTable.id, task.id));
      }
      await refreshSubtaskCounts(
        tx,
        tasks.map((task) => task.parentId),
      );
      await refreshBlockedCounts(
        tx,
        tasks.map((task) => task.id),
      );
    }

    await tx
      .delete(projectColumnTable)
      .where(eq(projectColumnTable.id, columnId));
  });
  return { txid };
}
