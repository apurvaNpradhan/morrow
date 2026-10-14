import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectColumnTable } from "#api/projects/tables";
import { findColumn } from "../lib/find-column";
import { assertNotLastRequiredColumn } from "../lib/required-columns";

/**
 * Deletes a column. Its items move to `targetColumnId` in the same
 * transaction, so nothing is lost and nobody has to empty the column by hand.
 * (There are no items yet; tasks will move here when they exist.)
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
    await findColumn(tx, projectId, targetColumnId).catch(() => {
      throw projectError("INVALID_TARGET_COLUMN");
    });
    await assertNotLastRequiredColumn(tx, projectId, column);
    await tx
      .delete(projectColumnTable)
      .where(eq(projectColumnTable.id, columnId));
  });
  return { txid };
}
