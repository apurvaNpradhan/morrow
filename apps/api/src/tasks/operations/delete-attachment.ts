import { removeAssetLinks } from "@morrow/sync-schemas";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import {
  assetTable,
  queueStorageCleanup,
  storageError,
} from "#api/storage/index";
import { findTask } from "#api/tasks/lib/find-task";
import { taskCommentTable, taskDescriptionTable } from "#api/tasks/tables";

/**
 * Deletes a file of a task and frees its object. Its images and cards are taken
 * out of the task's description and comments in the same transaction, so no
 * broken link is left behind; the comments are not marked edited, since it is
 * not their author's change. Runs under the project lock, so an archived
 * Project refuses it. The object is queued in the same transaction, and the
 * nightly sweep would catch it anyway.
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

    const [description] = await tx
      .select({ text: taskDescriptionTable.description })
      .from(taskDescriptionTable)
      .where(eq(taskDescriptionTable.taskId, taskId));
    const stripped = removeAssetLinks(description?.text ?? "", asset.id);
    if (description && stripped !== description.text) {
      await tx
        .update(taskDescriptionTable)
        .set({ description: stripped })
        .where(eq(taskDescriptionTable.taskId, taskId));
    }
    const comments = await tx
      .select({ id: taskCommentTable.id, body: taskCommentTable.body })
      .from(taskCommentTable)
      .where(
        and(
          eq(taskCommentTable.taskId, taskId),
          like(taskCommentTable.body, `%/api/asset/${asset.id}%`),
        ),
      );
    for (const comment of comments) {
      await tx
        .update(taskCommentTable)
        .set({
          body: removeAssetLinks(comment.body, asset.id),
          updatedAt: new Date(),
        })
        .where(eq(taskCommentTable.id, comment.id));
    }
    await queueStorageCleanup(tx, [asset.objectKey]);
  });
  return { txid };
}
