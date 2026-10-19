import { extendRange, toggle } from "./selection";
import { currentSelection, setSelection } from "./selection-store";
import { currentView } from "./view-order-store";

/** Toggles a task in the selection, and makes it the anchor of the next range. */
export function toggleSelected(projectId: string, taskId: string) {
  const { ids } = currentSelection(projectId);
  setSelection(projectId, toggle(ids, taskId), taskId);
}

/**
 * A click with a modifier selects instead of opening: Cmd/Ctrl toggles, Shift
 * extends from the anchor (within the target's Column on the board, across the
 * list order in the list). Returns whether it was one.
 */
export function selectByClick(
  projectId: string,
  taskId: string,
  event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
) {
  if (event.metaKey || event.ctrlKey) {
    toggleSelected(projectId, taskId);
    return true;
  }
  if (!event.shiftKey) return false;
  const { ids, anchor } = currentSelection(projectId);
  const view = currentView();
  const order = (
    view.lanes?.find((lane) => lane.some((task) => task.id === taskId)) ??
    view.selectable ??
    view.tasks
  ).map((task) => task.id);
  setSelection(projectId, extendRange(ids, order, anchor, taskId), taskId);
  return true;
}

/**
 * Shift-click extends a range of tasks, but the browser also reads it as
 * "extend the text selection" and highlights everything between the two
 * clicks. Cancel that on mousedown; other clicks are left alone.
 */
export function keepTextUnselectedOnShiftClick(event: {
  shiftKey: boolean;
  preventDefault: () => void;
}) {
  if (event.shiftKey) event.preventDefault();
}
