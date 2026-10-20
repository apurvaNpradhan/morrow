import { inArray } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import {
  assetKeyPrefix,
  isStorageConfigured,
  listObjects,
} from "#api/storage/lib/s3";
import { assetTable } from "#api/storage/tables";
import { queueStorageCleanup } from "./cleanup-queue";

const GRACE_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

/**
 * Deletes stored assets that no row points at. A task, project or workspace
 * delete cascades the rows but cannot reach the objects; a save that rolled
 * back after copying leaves one too. Objects younger than a day are left, so
 * an upload whose row is about to be written is never touched. `now` is a
 * parameter for tests.
 */
export async function sweepOrphanedAssets(now = new Date()) {
  if (!isStorageConfigured()) return;
  const cutoff = now.getTime() - GRACE_MS;
  const check = async (keys: string[]) => {
    if (!keys.length) return;
    const known = await db
      .select({ key: assetTable.objectKey })
      .from(assetTable)
      .where(inArray(assetTable.objectKey, keys));
    const knownKeys = new Set(known.map((row) => row.key));
    await queueStorageCleanup(
      db,
      keys.filter((key) => !knownKeys.has(key)),
    );
  };

  let batch: string[] = [];
  for await (const object of listObjects(assetKeyPrefix())) {
    if (object.lastModified.getTime() >= cutoff) continue;
    batch.push(object.key);
    if (batch.length === BATCH) {
      await check(batch);
      batch = [];
    }
  }
  await check(batch);
}
