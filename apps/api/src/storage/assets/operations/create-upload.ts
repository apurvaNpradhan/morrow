import { createId } from "@paralleldrive/cuid2";
import { ASSET_MAX_BYTES } from "@morrow/sync-schemas";
import { db } from "#api/platform/database/index";
import { assetTable } from "#api/storage/tables";
import { storageError } from "#api/storage/errors";
import {
  assetObjectKey,
  createAssetUploadUrl,
  isStorageConfigured,
} from "#api/storage/lib/s3";
import { normalizeMimeType } from "../mime-type";

/**
 * Starts an upload: records a draft that only its uploader can see and signs
 * the URL the browser PUTs the file to. A draft nobody claims is deleted after
 * a day.
 */
export async function createAssetUpload(
  workspaceId: string,
  userId: string,
  input: { filename: string; contentType: string; size: number },
) {
  if (input.size <= 0) throw storageError("UPLOAD_INVALID");
  if (input.size > ASSET_MAX_BYTES) throw storageError("UPLOAD_TOO_LARGE");
  if (!isStorageConfigured()) throw storageError("STORAGE_UNAVAILABLE");

  const assetId = createId();
  const objectKey = assetObjectKey(workspaceId, assetId);
  const mimeType = normalizeMimeType(input.contentType);
  const { uploadUrl, headers } = await createAssetUploadUrl({
    key: objectKey,
    size: input.size,
    contentType: mimeType,
  });
  await db.insert(assetTable).values({
    id: assetId,
    workspaceId,
    objectKey,
    filename: input.filename,
    mimeType,
    size: input.size,
    createdBy: userId,
  });
  return { assetId, uploadUrl, headers };
}
