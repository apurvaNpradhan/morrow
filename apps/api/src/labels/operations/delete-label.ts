import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { findLabel } from "#api/labels/lib/find-label";
import { labelTable } from "#api/labels/tables";
import { projectTable } from "#api/projects/index";
import { taskTable } from "#api/tasks/index";

/**
 * Deletes a label and strips it from every task of the Workspace in the same
 * transaction. `task.label_ids` has no foreign key, so this is the only path
 * that keeps it consistent. The label row is locked first: applying a label
 * holds a share lock on it, so an apply in flight either finishes before the
 * strip or finds the label gone. No per-task history is written (a system
 * cascade).
 */
export async function deleteLabel(workspaceId: string, labelId: string) {
  const { txid } = await withTxid(async (tx) => {
    await findLabel(tx, workspaceId, labelId, "update");
    await tx
      .update(taskTable)
      .set({ labelIds: sql`array_remove(${taskTable.labelIds}, ${labelId})` })
      .where(
        sql`${taskTable.projectId} IN (SELECT ${projectTable.id} FROM ${projectTable} WHERE ${projectTable.workspaceId} = ${workspaceId}) AND ${labelId} = ANY(${taskTable.labelIds})`,
      );
    await tx.delete(labelTable).where(eq(labelTable.id, labelId));
  });
  return { txid };
}
