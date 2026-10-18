import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { getActiveTaskId } from "../lib/active-task-store";
import { openFieldPicker, type PickerField } from "../lib/field-picker-store";
import { taskHotkeysAllowed } from "../lib/hotkey-scope";
import { focusedTaskId } from "../lib/task-links";
import { requestDeleteTask } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";

/**
 * The shortcuts that edit the focused task, or the one open in the sheet or on
 * its page: `S` status, `P` priority, `A` assignee, `L` labels, due date,
 * "assign to me" and delete. Mounted by the project page and the task page.
 */
export function useTaskFieldHotkeys() {
  const hotkeys = useAppHotkeys();
  const { can, frozen, meId } = useTaskView();
  const actions = useTaskActions();
  const editable = can.edit && !frozen;

  function currentTask() {
    const id = focusedTaskId() ?? getActiveTaskId();
    return id ? taskCollection.get(id) : undefined;
  }

  const guarded = (run: () => void) => () => {
    if (taskHotkeysAllowed()) run();
  };

  function pick(field: PickerField, sheetField: string) {
    return guarded(() => {
      if (!editable) return;
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
      hotkey: hotkeys.assignTaskToMe,
      callback: guarded(() => {
        const task = currentTask();
        if (task && editable && meId) void actions.setAssignee(task, meId);
      }),
    },
    {
      hotkey: hotkeys.deleteTask,
      callback: guarded(() => {
        const task = currentTask();
        if (task && can.delete && !frozen) requestDeleteTask(task);
      }),
    },
  ]);
}
