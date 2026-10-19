import { useSyncExternalStore } from "react";
import { onSyncedCollectionsCleared } from "@/app/sync/synced-collections";
import { prune } from "./selection";

/**
 * The tasks selected in one Project's board or list, and the one a Shift-click
 * extends from. Not persisted. A selection of another Project reads as empty,
 * so switching Projects never carries it over.
 */
type State = {
  projectId: string;
  ids: ReadonlySet<string>;
  anchor: string | null;
};

const EMPTY: ReadonlySet<string> = new Set();
let state: State = { projectId: "", ids: EMPTY, anchor: null };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSelection(
  projectId: string,
  ids: ReadonlySet<string>,
  anchor: string | null,
) {
  set({ projectId, ids, anchor });
}

export function clearSelection() {
  if (state.ids.size === 0) return;
  set({ projectId: state.projectId, ids: EMPTY, anchor: null });
}

/** Drops selected tasks that are no longer shown (filtered out, collapsed, deleted). */
export function pruneSelection(shown: readonly string[]) {
  const ids = prune(state.ids, shown);
  if (ids === state.ids) return;
  set({
    ...state,
    ids,
    anchor:
      state.anchor !== null && ids.has(state.anchor) ? state.anchor : null,
  });
}

export function currentSelection(projectId: string) {
  return state.projectId === projectId
    ? { ids: state.ids, anchor: state.anchor }
    : { ids: EMPTY, anchor: null };
}

export function useSelectedIds(projectId: string) {
  return useSyncExternalStore(subscribe, () =>
    state.projectId === projectId ? state.ids : EMPTY,
  );
}

/** Whether one task is selected; a card re-renders only when its own answer changes. */
export function useIsSelected(projectId: string, taskId: string) {
  return useSyncExternalStore(
    subscribe,
    () => state.projectId === projectId && state.ids.has(taskId),
  );
}

/** Stands for "the selection" where a picker or dialog takes a task id. */
export const SELECTION = "selection";

onSyncedCollectionsCleared(clearSelection);
