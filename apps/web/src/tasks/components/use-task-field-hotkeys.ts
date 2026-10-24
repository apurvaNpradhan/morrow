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
import { requestMoveTasks } from "../lib/move-store";
import { requestDeleteTasks } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";
import { revealSheetField } from "./reveal-sheet-field";

/**
 * The shortcuts that edit the focused task, or the one open in the sheet or on
 * its page: `S` status, `P` priority, `A` assignee, `L` labels, `Shift+F` custom Fields, due date,
 * "assign to me", `M` move to another project and delete. Mounted by the project page and the task page.
 */
export function useTaskFieldHotkeys() {
  const hotkeys = useAppHotkeys();
  const { can, fields, frozen, meId, project } = useTaskView();
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const editable = can.edit && !frozen;
  // Viewers are offered no selection actions, so they get no selection.
  const canSelect = (can.edit || can.delete) && !frozen;

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

  /** Whether the selection is the target and small enough; over the cap it says so. */
  function selectionReady(tasks: unknown[]) {
    return tasks.length > 0 && bulk.allowed(tasks.length);
  }

  function pick(field: PickerField, sheetField: string) {
    return guarded(() => {
      if (!editable) return;
      const selection = selectionTarget();
      if (selection.length > 0) {
        const bar = document.querySelector("[data-selection-bar]");
        if (bar && selectionReady(selection)) {
          openFieldPicker(SELECTION, field, bar);
        }
        return;
      }
      const sheetChip = document.querySelector<HTMLElement>(
        `[data-sheet-field="${sheetField}"]`,
      );
      if (sheetChip) {
        sheetChip.click();
        return;
      }
      if (sheetIsOpen()) {
        revealSheetField(sheetField);
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
    {
      hotkey: hotkeys.setTaskStartDate,
      callback: pick("startDate", "startDate"),
    },
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
        else if (sheetIsOpen()) revealSheetField("field");
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
      hotkey: hotkeys.moveTask,
      callback: guarded(() => {
        if (!editable || !can.create) return;
        const selection = selectionTarget();
        if (selection.length > 0) {
          requestMoveTasks(selection);
          return;
        }
        const task = currentTask();
        if (task) requestMoveTasks([task]);
      }),
    },
    {
      hotkey: hotkeys.deleteTask,
      callback: guarded(() => {
        if (!can.delete || frozen) return;
        const selection = selectionTarget();
        if (selection.length > 0) {
          if (selectionReady(selection)) requestDeleteTasks(selection);
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
        if (id && canSelect && !sheetIsOpen()) toggleSelected(project.id, id);
      }),
    },
    {
      hotkey: hotkeys.selectAllTasks,
      callback: (event) => {
        if (!canSelect || !taskHotkeysAllowed() || sheetIsOpen()) return;
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
