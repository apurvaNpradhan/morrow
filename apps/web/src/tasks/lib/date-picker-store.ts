import { useSyncExternalStore } from "react";

/** The task whose due date is being picked from a calendar field, if any. */
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

/** Opens the date field for a task ("Pick a date" in any due-date menu). */
export function openDatePicker(taskId: string) {
  set(taskId);
}

export function closeDatePicker() {
  set(null);
}

export function useDatePickerTask() {
  return useSyncExternalStore(subscribe, () => current);
}
