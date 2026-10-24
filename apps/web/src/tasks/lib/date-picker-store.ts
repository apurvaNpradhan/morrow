import { useSyncExternalStore } from "react";

/** Which of a task's two dates the calendar field sets. */
export type DateField = "startDate" | "dueDate";

/** The task and date being picked from a calendar field, if any. */
type OpenDatePicker = { taskId: string; field: DateField };

let current: OpenDatePicker | null = null;
const listeners = new Set<() => void>();

function set(next: OpenDatePicker | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the date field for a task ("Pick a date" in a start or due date menu). */
export function openDatePicker(taskId: string, field: DateField) {
  set({ taskId, field });
}

export function closeDatePicker() {
  set(null);
}

export function useDatePicker() {
  return useSyncExternalStore(subscribe, () => current);
}
