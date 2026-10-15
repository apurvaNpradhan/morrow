import {
  trackCollection,
  type TrackedCollection,
} from "@/app/devtools/sync/collection-registry";

const syncedCollections: Array<{ cleanup: () => Promise<void> }> = [];
const cleanupHooks: Array<() => void> = [];

/** Runs `hook` after the synced collections are cleared, for caches built on top of them. */
export function onSyncedCollectionsCleared(hook: () => void) {
  cleanupHooks.push(hook);
}

/**
 * Every synced collection is registered here when it is created, so signing
 * out can clear them all without anyone remembering to. Device preferences are
 * local and are not registered.
 */
export function registerSyncedCollection<Collection extends TrackedCollection>(
  collection: Collection,
): Collection {
  syncedCollections.push(collection);
  if (import.meta.env.DEV) trackCollection(collection);
  return collection;
}

/**
 * Stops every synced collection and drops its rows. A collection that is used
 * again starts a new sync, as the next signed-in user.
 */
export async function cleanupSyncedCollections(): Promise<void> {
  await Promise.all(
    syncedCollections.map((collection) => collection.cleanup()),
  );
  for (const hook of cleanupHooks) hook();
}
