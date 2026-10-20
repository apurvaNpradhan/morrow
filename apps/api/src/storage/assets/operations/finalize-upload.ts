import {
  ASSET_INLINE_IMAGE_MAX_BYTES,
  ASSET_MAX_BYTES,
} from "@morrow/sync-schemas";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { storageError } from "#api/storage/errors";
import {
  deleteS3Object,
  headAssetObject,
  readAssetHead,
} from "#api/storage/lib/s3";
import { assetTable } from "#api/storage/tables";
import { sniffImage } from "../sniff-image";

/** Enough of a file's start to read any supported image header. */
const SNIFF_BYTES = 64 * 1024;

/**
 * Checks the uploaded object and settles what the asset is. The size must be
 * the one declared; the type comes from the bytes (an image up to 20 MB is
 * shown inline, everything else is a file). A wrong object is deleted with its
 * row; a missing one leaves the draft so the upload can be retried.
 */
export async function finalizeAssetUpload(
  workspaceId: string,
  userId: string,
  assetId: string,
) {
  const [draft] = await db
    .select()
    .from(assetTable)
    .where(
      and(
        eq(assetTable.id, assetId),
        eq(assetTable.workspaceId, workspaceId),
        eq(assetTable.createdBy, userId),
        isNull(assetTable.attachedAt),
      ),
    );
  if (!draft) throw storageError("ASSET_NOT_FOUND");

  const head = await headAssetObject(draft.objectKey);
  if (!head) throw storageError("UPLOAD_MISSING");
  if (head.size !== draft.size || head.size > ASSET_MAX_BYTES) {
    await deleteS3Object(draft.objectKey);
    await db.delete(assetTable).where(eq(assetTable.id, draft.id));
    throw storageError("UPLOAD_INVALID");
  }

  const image = sniffImage(await readAssetHead(draft.objectKey, SNIFF_BYTES));
  const inline = image !== null && head.size <= ASSET_INLINE_IMAGE_MAX_BYTES;
  const settled = {
    kind: inline ? ("image" as const) : ("file" as const),
    mimeType: image?.mimeType ?? draft.mimeType,
    width: inline ? image.width : null,
    height: inline ? image.height : null,
  };
  await db.update(assetTable).set(settled).where(eq(assetTable.id, draft.id));
  return {
    id: draft.id,
    filename: draft.filename,
    size: draft.size,
    ...settled,
  };
}
