import { eq, sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { assetTable } from "#api/platform/database/schema";
import { deleteS3Object } from "#api/storage/lib/s3";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Serialize reference changes and deletion for this object only.
export async function withStorageObject<T>(
  objectKey: string,
  apply: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('storage-object'), hashtext(${objectKey}))`,
    );
    return apply(tx);
  });
}

/**
 * Deletes the object unless an asset references it again. Returns whether the
 * queued deletion is finished (deleted, or no longer wanted); throws when the
 * provider fails so the caller can retry.
 */
export async function removeUnreferencedObject(
  tx: Transaction,
  objectKey: string,
): Promise<void> {
  const [asset] = await tx
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(eq(assetTable.objectKey, objectKey))
    .for("key share");
  if (asset) return;
  await deleteS3Object(objectKey);
}
