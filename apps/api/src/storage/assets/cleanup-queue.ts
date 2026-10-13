import type { db } from "#api/platform/database/index";
import { deleteObjectQueue } from "#api/storage/jobs";

/** Queues the objects for deletion. */
export async function queueStorageCleanup(
  tx: Pick<typeof db, "insert" | "execute">,
  keys: string[],
) {
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length) return;
  await deleteObjectQueue.enqueueMany(
    uniqueKeys.map((objectKey) => ({
      data: { objectKey },
      singletonKey: objectKey,
    })),
    { tx },
  );
}
