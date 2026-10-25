import { useSyncExternalStore } from "react";

/** The write waiting for the user's yes: it would end a series. */
let pending: (() => Promise<unknown>) | null = null;
const listeners = new Set<() => void>();

function set(next: (() => Promise<unknown>) | null) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks whether to go ahead with a write that stops tasks repeating; the one dialog is mounted with the page. */
export function requestStopRepeating(proceed: () => Promise<unknown>) {
  set(proceed);
}

export function cancelStopRepeating() {
  set(null);
}

export function usePendingStopRepeating() {
  return useSyncExternalStore(subscribe, () => pending);
}
