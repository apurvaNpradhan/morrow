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

let restoringFocus = false;

/**
 * Closing the sheet puts focus back on its card, which is not the user picking
 * that task; the next focus after it does not make the task active.
 */
export function markFocusRestore() {
  restoringFocus = true;
  // The focus follows at once; if nothing takes it, do not eat a later one.
  setTimeout(() => (restoringFocus = false), 0);
  return true;
}

export function takeFocusRestore() {
  const was = restoringFocus;
  restoringFocus = false;
  return was;
}
