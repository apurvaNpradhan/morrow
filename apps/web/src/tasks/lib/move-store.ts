import type { ProjectRow, TaskRow } from "@morrow/sync-schemas";
import { useSyncExternalStore } from "react";

/** The move that is being set up: the Tasks, and the Project once it is picked. */
type Move = { tasks: TaskRow[]; to: ProjectRow | null };

let current: Move | null = null;
const listeners = new Set<() => void>();

function set(next: Move | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the Project picker for these Tasks; the one dialog is mounted with the page. */
export function requestMoveTasks(tasks: TaskRow[]) {
  if (tasks.length > 0) set({ tasks, to: null });
}

/** The Project is picked: on to the question, or straight to the move. */
export function chooseMoveProject(to: ProjectRow) {
  if (current) set({ ...current, to });
}

/** Back to the Project picker. */
export function backToProjects() {
  if (current) set({ ...current, to: null });
}

export function closeMove() {
  set(null);
}

export function useMove() {
  return useSyncExternalStore(subscribe, () => current);
}
