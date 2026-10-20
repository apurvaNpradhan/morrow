import { and, asc, inArray, isNull, lt } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { queueStorageCleanup } from "./cleanup-queue";
import { assetTable } from "#api/storage/tables";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Deletes drafts nobody claimed within a day, and queues their objects for deletion. */
export async function cleanupDraftUploads() {
  const cutoff = new Date(Date.now() - DRAFT_TTL_MS);
  const deadline = Date.now() + 60_000;
  do {
    const count = await db.transaction(async (tx) => {
      const batch = await tx
        .select({ id: assetTable.id })
        .from(assetTable)
        .where(
          and(isNull(assetTable.attachedAt), lt(assetTable.createdAt, cutoff)),
        )
        .orderBy(asc(assetTable.createdAt), asc(assetTable.id))
        .limit(500)
        .for("update", { skipLocked: true });
      if (!batch.length) return 0;
      const expired = await tx
        .delete(assetTable)
        .where(
          inArray(
            assetTable.id,
            batch.map((asset) => asset.id),
          ),
        )
        .returning({ objectKey: assetTable.objectKey });
      await queueStorageCleanup(
        tx,
        expired.map((asset) => asset.objectKey),
      );
      return expired.length;
    });
    if (count < 500) break;
  } while (Date.now() < deadline);
}
