import { db } from "#api/platform/database/index";
import { ownedImageKey, queueStorageCleanup } from "#api/storage/index";

/** Queues a user's avatar object for deletion; used when their account is deleted. */
export async function queueAvatarCleanup(
  userId: string,
  image: string | null | undefined,
) {
  const key = ownedImageKey(image, "avatars", userId);
  if (key) await queueStorageCleanup(db, [key]);
}
