import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";
import { removeOwnedImage } from "#api/storage/index";

/**
 * The one writer of `user.image`. Swaps it under a row lock, then deletes the
 * object the user had before (queued for retry if the delete fails). Only
 * objects under the user's own avatar folder are deleted.
 */
export async function setUserImage(userId: string, image: string | null) {
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ image: userTable.image })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .for("update");
    if (!row) return null;
    await tx.update(userTable).set({ image }).where(eq(userTable.id, userId));
    return row.image;
  });
  const hadImage = await removeOwnedImage(previous, "avatars", userId);
  return { hadImage };
}
