import type { TaskRow } from "@morrow/sync-schemas";
import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { openFieldPicker, type PickerField } from "../lib/field-picker-store";
import { taskHotkeysAllowed } from "../lib/hotkey-scope";
import { focusedTaskId } from "../lib/task-links";
import { focusTask } from "../lib/focus-task";
import { currentView, neighborInView } from "../lib/view-order-store";
import { requestDeleteTask } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";

/** Whether the focus is in a field where arrow keys move a cursor. */
function isEditing(element: Element | null) {
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable ||
      element.matches("input, textarea, select, [role='textbox']"))
  );
}

/** A task shortcut's callback: runs only where it may, and never for a no-op. */
type Run = () => void;

/**
 * The page's keyboard shortcuts for tasks: filter, display and search, `J` and
 * `K` through the view, and the ones that act on the task that has focus (or
 * the one open in the sheet): Column, priority, assignee, "assign to me", due
 * date and delete.
 */
export function useTaskHotkeys({
  openTask,
  openNumber,
  openFilter,
  openDisplay,
  focusSearch,
}: {
  /** Opens a task in the sheet. */
  openTask: (task: TaskRow) => void;
  /** The ticket number open in the sheet, if any. */
  openNumber: number | null;
  openFilter: () => void;
  openDisplay: () => void;
  focusSearch: () => void;
}) {
  const hotkeys = useAppHotkeys();
  const { can, frozen, meId } = useTaskView();
  const actions = useTaskActions();
  const editable = can.edit && !frozen;

  /** The sheet's task when it is open, else the focused card or row. */
  function currentTask() {
    const id = focusedTaskId();
    if (id) return taskCollection.get(id);
    if (openNumber === null) return undefined;
    return taskCollection.toArray.find((task) => task.number === openNumber);
  }

  const guarded =
    (run: Run): Run =>
    () => {
      if (taskHotkeysAllowed()) run();
    };

  function pick(field: PickerField, sheetField: string): Run {
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

  function step(delta: 1 | -1): Run {
    return guarded(() => {
      const task = currentTask();
      if (!task) return;
      const next = neighborInView(task.id, delta);
      if (!next) return;
      if (openNumber !== null) {
        openTask(next);
        // The list behind the sheet follows, so closing it lands on the task.
        currentView().reveal(next.id);
      } else focusTask(next.id);
    });
  }

  /** Up and down switch tasks while the sheet is open, unless the cursor is in a text field. */
  function stepInSheet(delta: 1 | -1): Run {
    return () => {
      if (openNumber === null || isEditing(document.activeElement)) return;
      step(delta)();
    };
  }

  useHotkeys([
    { hotkey: hotkeys.filterTasks, callback: guarded(openFilter) },
    { hotkey: hotkeys.displayOptions, callback: guarded(openDisplay) },
    { hotkey: hotkeys.searchTasks, callback: guarded(focusSearch) },
    { hotkey: hotkeys.nextTask, callback: step(1) },
    { hotkey: hotkeys.previousTask, callback: step(-1) },
    { hotkey: "ArrowDown", callback: stepInSheet(1) },
    { hotkey: "ArrowUp", callback: stepInSheet(-1) },
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
