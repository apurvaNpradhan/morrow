import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { getActiveTaskId } from "../lib/active-task-store";
import { openFieldPicker, type PickerField } from "../lib/field-picker-store";
import { taskHotkeysAllowed } from "../lib/hotkey-scope";
import { focusedTaskId } from "../lib/task-links";
import { useBulkActions } from "../actions/use-bulk-actions";
import { selectedTasks, sheetIsOpen } from "../lib/selected-tasks";
import {
  SELECTION,
  currentSelection,
  setSelection,
} from "../lib/selection-store";
import { selectAll } from "../lib/selection";
import { toggleSelected } from "../lib/select-gesture";
import { currentView } from "../lib/view-order-store";
import { requestDeleteTasks } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";

/**
 * The shortcuts that edit the focused task, or the one open in the sheet or on
 * its page: `S` status, `P` priority, `A` assignee, `L` labels, `Shift+F` custom Fields, due date,
 * "assign to me" and delete. Mounted by the project page and the task page.
 */
export function useTaskFieldHotkeys() {
  const hotkeys = useAppHotkeys();
  const { can, fields, frozen, meId, project } = useTaskView();
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const editable = can.edit && !frozen;

  function currentTask() {
    const id = focusedTaskId() ?? getActiveTaskId();
    return id ? taskCollection.get(id) : undefined;
  }

  const guarded = (run: () => void) => () => {
    if (taskHotkeysAllowed()) run();
  };

  /** The selection is the target unless the sheet is open: then its own task is. */
  function selectionTarget() {
    if (sheetIsOpen()) return [];
    return selectedTasks(project.id);
  }

  function pick(field: PickerField, sheetField: string) {
    return guarded(() => {
      if (!editable) return;
      if (selectionTarget().length > 0) {
        const bar = document.querySelector("[data-selection-bar]");
        if (bar) openFieldPicker(SELECTION, field, bar);
        return;
      }
      const sheetChip = document.querySelector<HTMLElement>(
        `[data-sheet-field="${sheetField}"]`,
      );
      if (sheetChip) {
        sheetChip.click();
        return;
      }
      const id = focusedTaskId();
      const card = id ? document.querySelector(`[data-task-id="${id}"]`) : null;
      if (id && card) openFieldPicker(id, field, card);
    });
  }

  useHotkeys([
    { hotkey: hotkeys.setTaskColumn, callback: pick("column", "column") },
    { hotkey: hotkeys.setTaskPriority, callback: pick("priority", "priority") },
    { hotkey: hotkeys.assignTask, callback: pick("assignee", "assignee") },
    { hotkey: hotkeys.setTaskDueDate, callback: pick("dueDate", "dueDate") },
    { hotkey: hotkeys.setTaskLabels, callback: pick("labels", "labels") },
    {
      hotkey: hotkeys.setTaskField,
      callback: guarded(() => {
        const task = currentTask();
        if (!task || !editable || fields.length === 0) return;
        // In the sheet the first Field's chip anchors it; on the board, the focused card.
        const anchor =
          document.querySelector('[data-sheet-field^="field:"]') ??
          document.querySelector(`[data-task-id="${task.id}"]`);
        if (anchor) openFieldPicker(task.id, "fields", anchor);
      }),
    },
    {
      hotkey: hotkeys.assignTaskToMe,
      callback: guarded(() => {
        if (editable && meId && selectionTarget().length > 0) {
          void bulk.setAssignee(meId);
          return;
        }
        const task = currentTask();
        if (task && editable && meId) void actions.setAssignee(task, meId);
      }),
    },
    {
      hotkey: hotkeys.deleteTask,
      callback: guarded(() => {
        if (!can.delete || frozen) return;
        const selection = selectionTarget();
        if (selection.length > 0) {
          requestDeleteTasks(selection);
          return;
        }
        const task = currentTask();
        if (task) requestDeleteTasks([task]);
      }),
    },
    {
      hotkey: hotkeys.toggleTaskSelection,
      callback: guarded(() => {
        const id = focusedTaskId();
        if (id && !sheetIsOpen()) toggleSelected(project.id, id);
      }),
    },
    {
      hotkey: hotkeys.selectAllTasks,
      callback: (event) => {
        if (!taskHotkeysAllowed() || sheetIsOpen()) return;
        const view = currentView();
        event.preventDefault();
        setSelection(
          project.id,
          selectAll((view.selectable ?? view.tasks).map((task) => task.id)),
          currentSelection(project.id).anchor,
        );
      },
    },
  ]);
}
