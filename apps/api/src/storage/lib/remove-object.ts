import { db } from "#api/platform/database/index";
import { queueStorageCleanup } from "#api/storage/assets/cleanup-queue";
import { deleteS3Object } from "./s3";
import { logFailure } from "#api/platform/logger";

/**
 * Deletes an object now; if that fails, queues the key so the scheduler
 * retries. Never throws: the caller's change has already been committed.
 */
export async function removeObjectOrQueue(key: string): Promise<void> {
  try {
    await deleteS3Object(key);
  } catch {
    await queueStorageCleanup(db, [key]).catch(() => {
      logFailure("storage.queue-cleanup");
    });
  }
}
