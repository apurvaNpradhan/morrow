import { isClosedCategory } from "@morrow/sync-schemas";
import { and, eq, isNull } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { findColumn, lockProject } from "#api/projects/index";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { taskError } from "#api/tasks/errors";
import { taskTable } from "#api/tasks/tables";

/**
 * Archives every unarchived task of a done or canceled column in one
 * transaction. The txid is null when there was nothing to archive.
 */
export async function archiveColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
) {
  const { result: count, txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const column = await findColumn(tx, projectId, columnId);
    if (!isClosedCategory(column.category)) {
      throw taskError("COLUMN_NOT_CLOSED");
    }
    const archived = await tx
      .update(taskTable)
      .set({ archivedAt: new Date() })
      .where(
        and(eq(taskTable.columnId, columnId), isNull(taskTable.archivedAt)),
      )
      .returning({ id: taskTable.id, parentId: taskTable.parentId });
    await refreshSubtaskCounts(
      tx,
      archived.map((task) => task.parentId),
    );
    return archived.length;
  });
  return { count, txid: count > 0 ? txid : null };
}
