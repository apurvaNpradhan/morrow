import { createId } from "@paralleldrive/cuid2";
import { ORPCError } from "@orpc/server";
import { config } from "#api/platform/config";
import { readImageFile } from "#api/storage/lib/image-upload";
import { removeObjectOrQueue } from "#api/storage/lib/remove-object";
import {
  isPublicStorageConfigured,
  keyFromPublicUrl,
  publicUrl,
  putPublicObject,
} from "#api/storage/lib/s3";
import { logFailure } from "#api/platform/logger";

/** Each public image lives under `<folder>/<ownerId>/`, so ownership can be read off the key. */
export type ImageFolder = "avatars" | "workspace-logos" | "project-backgrounds";

const unavailable = () =>
  new ORPCError("SERVICE_UNAVAILABLE", {
    data: { code: "STORAGE_UNAVAILABLE" },
  });

function ownerPrefix(folder: ImageFolder, ownerId: string) {
  const prefix = config.s3.keyPrefix.replace(/\/+$/, "");
  const scoped = `${folder}/${ownerId}/`;
  return prefix ? `${prefix}/${scoped}` : scoped;
}

/**
 * The object key behind a stored image URL, only when it is one of this
 * owner's own objects. Anything else (another owner's key, an external URL, a
 * client-supplied value) is never ours to delete.
 */
export function ownedImageKey(
  url: string | null | undefined,
  folder: ImageFolder,
  ownerId: string,
): string | null {
  if (!url || !isPublicStorageConfigured()) return null;
  const key = keyFromPublicUrl(url);
  return key?.startsWith(ownerPrefix(folder, ownerId)) ? key : null;
}

/** Queues or deletes every object a deleted owner's stored image points at. */
export async function removeOwnedImage(
  url: string | null | undefined,
  folder: ImageFolder,
  ownerId: string,
) {
  const key = ownedImageKey(url, folder, ownerId);
  if (key) await removeObjectOrQueue(key);
  return Boolean(key);
}

/**
 * Stores an uploaded image under a fresh key, then lets `apply` point the
 * owner's row at it. If `apply` fails the new object is removed again.
 */
export async function savePublicImage(options: {
  folder: ImageFolder;
  ownerId: string;
  file: Blob;
  apply: (url: string) => Promise<unknown>;
}) {
  const { bytes, contentType, extension } = await readImageFile(options.file);
  if (!isPublicStorageConfigured()) throw unavailable();
  const key = `${ownerPrefix(options.folder, options.ownerId)}${createId()}.${extension}`;
  try {
    await putPublicObject(key, bytes, contentType);
  } catch (error) {
    // Provider errors can carry endpoints and credentials: log the kind only.
    logFailure("storage.image-upload", {
      folder: options.folder,
      errorName: (error as Error).name,
    });
    throw unavailable();
  }
  const url = publicUrl(key);
  try {
    await options.apply(url);
  } catch (error) {
    await removeObjectOrQueue(key);
    throw error;
  }
  return { url };
}
