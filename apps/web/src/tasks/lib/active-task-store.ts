import { useSyncExternalStore } from "react";

/**
 * The task the task commands act on: the last card or row that had focus, or
 * the task open in the sheet or on its page. The palette takes focus when it
 * opens, so the focus itself cannot say which task was meant.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setActiveTaskId(id: string | null) {
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
}

export function getActiveTaskId() {
  return current;
}

export function useActiveTaskId() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
