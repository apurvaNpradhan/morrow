import { getPersistedReadinessSource } from "@tanstack/react-db";
import {
  trackCollection,
  type TrackedCollection,
} from "@/app/devtools/sync/collection-registry";

import {
  beginLocalWipe,
  finishLocalWipe,
  restoresFromLocal,
} from "./local-database";
import { removeOwnerStamp } from "./owner-stamp";

type SyncedCollection = {
  cleanup: () => Promise<void>;
  preload: () => Promise<void>;
  config: object;
};

const syncedCollections: SyncedCollection[] = [];
const cleanupHooks: Array<() => void | Promise<void>> = [];

/** Runs `hook` after the synced collections are cleared, for caches and local copies built on top of them. */
export function onSyncedCollectionsCleared(hook: () => void | Promise<void>) {
  cleanupHooks.push(hook);
}

/**
 * Every synced collection is registered here when it is created, so signing
 * out can clear them all without anyone remembering to. Device preferences are
 * local and are not registered.
 */
export function registerSyncedCollection<
  Collection extends TrackedCollection & { config: object },
>(collection: Collection): Collection {
  syncedCollections.push(collection);
  if (import.meta.env.DEV) trackCollection(collection);
  return collection;
}

/**
 * Starts a synced collection and resolves when its rows can be read. A page
 * that restores from the local database waits for the restore only, and the
 * network catches up in the background; otherwise it waits for the network.
 */
export async function loadSyncedCollection(collection: SyncedCollection) {
  const network = collection.preload();
  const restore = restoresFromLocal
    ? getPersistedReadinessSource(collection.config)
    : undefined;
  if (!restore) return network;
  // The network may fail or be stalled; the stored rows are what is shown.
  network.catch(() => undefined);
  await new Promise<void>((resolve) => {
    const settled = () => restore.getSnapshot().status !== "loading";
    if (settled()) return resolve();
    const unsubscribe = restore.subscribe(() => {
      if (!settled()) return;
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Signs the local copy out: stops every synced collection, drops its rows and
 * deletes the browser's database. The owner stamp goes first and synchronously,
 * so a wipe cut short by a page unload is finished on the next boot.
 */
export async function cleanupSyncedCollections(): Promise<void> {
  removeOwnerStamp();
  beginLocalWipe();
  await Promise.all(
    syncedCollections.map((collection) => collection.cleanup()),
  );
  await finishLocalWipe();
  await Promise.all(cleanupHooks.map((hook) => hook()));
}
