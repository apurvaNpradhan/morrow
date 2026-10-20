import { and, eq, isNotNull } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import {
  assetTable,
  queueStorageCleanup,
  storageError,
} from "#api/storage/index";
import { findTask } from "#api/tasks/lib/find-task";

/**
 * Deletes a file of a task and frees its object. The text that linked to it is
 * left as it is: the link just stops showing. Runs under the project lock, so
 * an archived Project refuses it. The object is queued in the same transaction,
 * and the nightly sweep would catch it anyway.
 */
export async function deleteAttachment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  assetId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await findTask(tx, projectId, taskId);
    const [asset] = await tx
      .select({ id: assetTable.id, objectKey: assetTable.objectKey })
      .from(assetTable)
      .where(
        and(
          eq(assetTable.id, assetId),
          eq(assetTable.workspaceId, workspaceId),
          eq(assetTable.taskId, taskId),
          isNotNull(assetTable.attachedAt),
        ),
      );
    if (!asset) throw storageError("ASSET_NOT_FOUND");
    await tx.delete(assetTable).where(eq(assetTable.id, asset.id));
    await queueStorageCleanup(tx, [asset.objectKey]);
  });
  return { txid };
}
