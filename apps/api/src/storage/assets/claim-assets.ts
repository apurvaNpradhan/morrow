import { createId } from "@paralleldrive/cuid2";
import { assetIdsIn, replaceAssetIds } from "@morrow/sync-schemas";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { db } from "#api/platform/database/index";
import { assetObjectKey, copyAssetObject } from "#api/storage/lib/s3";
import { assetTable } from "#api/storage/tables";

type Executor = Pick<typeof db, "select" | "insert" | "update">;

/**
 * Makes the files a saved text links to the task's own, and returns the text
 * to store. Run it in the transaction that writes the text.
 *
 * - The caller's own draft becomes the task's.
 * - A file of another task in the Workspace is copied inside the storage
 *   service, once per task however often the old link is saved again, and the
 *   link is swapped for the copy's. A task's files are always its own, so
 *   deleting one task never breaks another.
 * - Anything else (someone else's draft, another Workspace, an unknown id) is
 *   left as it is: the link simply does not show.
 *
 * A link removed from the text deletes nothing.
 */
export async function claimAssets(
  tx: Executor,
  scope: { workspaceId: string; taskId: string; userId: string },
  markdown: string,
): Promise<string> {
  const ids = assetIdsIn(markdown);
  if (!ids.length) return markdown;

  const assets = await tx
    .select()
    .from(assetTable)
    .where(
      and(
        inArray(assetTable.id, ids),
        eq(assetTable.workspaceId, scope.workspaceId),
      ),
    );
  const replacements = new Map<string, string>();
  for (const asset of assets) {
    if (asset.attachedAt === null) {
      if (asset.createdBy !== scope.userId) continue;
      await tx
        .update(assetTable)
        .set({ taskId: scope.taskId, attachedAt: new Date() })
        .where(and(eq(assetTable.id, asset.id), isNull(assetTable.attachedAt)));
    } else if (asset.taskId !== scope.taskId) {
      const [existing] = await tx
        .select({ id: assetTable.id })
        .from(assetTable)
        .where(
          and(
            eq(assetTable.taskId, scope.taskId),
            eq(assetTable.sourceAssetId, asset.id),
          ),
        )
        .limit(1);
      if (existing) {
        replacements.set(asset.id, existing.id);
        continue;
      }
      const copyId = createId();
      const objectKey = assetObjectKey(scope.workspaceId, copyId);
      await copyAssetObject(asset.objectKey, objectKey);
      await tx.insert(assetTable).values({
        id: copyId,
        workspaceId: scope.workspaceId,
        taskId: scope.taskId,
        sourceAssetId: asset.id,
        objectKey,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        kind: asset.kind,
        width: asset.width,
        height: asset.height,
        createdBy: scope.userId,
        attachedAt: new Date(),
      });
      replacements.set(asset.id, copyId);
    }
  }
  return replaceAssetIds(markdown, replacements);
}
