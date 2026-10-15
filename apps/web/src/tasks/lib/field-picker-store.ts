import { useSyncExternalStore } from "react";

export type PickerField = "column" | "priority" | "assignee" | "dueDate";

/** The field picker that is open: which task, which field, and what it hangs from. */
type OpenPicker = { taskId: string; field: PickerField; anchor: Element };

let current: OpenPicker | null = null;
const listeners = new Set<() => void>();

function set(next: OpenPicker | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Opens the one shared picker for a task's field, anchored to an element (the
 * chip that was clicked, or the focused card for a keyboard shortcut). One
 * picker instead of a menu per chip keeps a long board cheap.
 */
export function openFieldPicker(
  taskId: string,
  field: PickerField,
  anchor: Element,
) {
  set({ taskId, field, anchor });
}

export function closeFieldPicker() {
  set(null);
}

export function useOpenFieldPicker() {
  return useSyncExternalStore(subscribe, () => current);
}
