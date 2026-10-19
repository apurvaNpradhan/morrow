import type { TaskRow } from "@morrow/sync-schemas";
import { taskCollection } from "../collections/task-collection";
import { currentSelection } from "./selection-store";
import { currentView } from "./view-order-store";

/** The selected tasks that are shown, in view order, as they are now. */
export function selectedTasks(projectId: string): TaskRow[] {
  const { ids } = currentSelection(projectId);
  if (ids.size === 0) return [];
  const view = currentView();
  return (view.selectable ?? view.tasks).flatMap((shown) => {
    const task = ids.has(shown.id) ? taskCollection.get(shown.id) : undefined;
    return task ? [task] : [];
  });
}

/** Whether the task sheet is open: its own task, not the selection, is then the shortcut target. */
export function sheetIsOpen() {
  return document.querySelector('[data-slot="sheet-popup"]') !== null;
}
