import { createStore } from "./store";
import { traceWaits } from "./trace-waits";

/** What the panel reads from a synced collection. */
export type TrackedCollection = {
  id: string;
  status: string;
  size: number;
  toArray: unknown[];
  preload: () => Promise<void>;
  cleanup: () => Promise<void>;
  utils: object;
};

const collections = /* @__PURE__ */ createStore<TrackedCollection[]>([]);

export const trackedCollections = {
  get: collections.get,
  subscribe: collections.subscribe,
};

/** Lists a synced collection in the panel and logs its txid and match waits. */
export function trackCollection(collection: TrackedCollection) {
  traceWaits(collection);
  // A hot reload creates the collection again under the same id.
  collections.set([
    ...collections.get().filter((tracked) => tracked.id !== collection.id),
    collection,
  ]);
}
