import { useSyncExternalStore } from "react";

/** Reads a devtools store and re-renders when it changes. */
export function useStore<T>(store: {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
}): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
