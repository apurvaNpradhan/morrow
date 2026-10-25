import { useSyncExternalStore } from "react";

/** The task whose repeat rule the custom form is editing, if any. */
let current: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the custom repeat form for a task ("Custom…" in any repeat menu). */
export function openRecurrenceDialog(taskId: string) {
  set(taskId);
}

export function closeRecurrenceDialog() {
  set(null);
}

export function useRecurrenceDialogTask() {
  return useSyncExternalStore(subscribe, () => current);
}
