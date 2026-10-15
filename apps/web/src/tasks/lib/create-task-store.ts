import { useSyncExternalStore } from "react";

/** Where a new task starts: a Project and Column, either of which may be left to the dialog. */
export type CreateTaskPreset = { projectId?: string; columnId?: string };

type State = { open: boolean; preset: CreateTaskPreset };

let state: State = { open: false, preset: {} };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the create-task dialog; the one dialog is mounted with the command palette. */
export function openCreateTask(preset: CreateTaskPreset = {}) {
  set({ open: true, preset });
}

export function closeCreateTask() {
  set({ ...state, open: false });
}

export function useCreateTaskState() {
  return useSyncExternalStore(subscribe, () => state);
}
