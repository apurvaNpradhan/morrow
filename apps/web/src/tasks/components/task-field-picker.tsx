import type { TaskRow } from "@morrow/sync-schemas";
import { Menu, MenuItem, MenuPopup } from "@/design-system/ui/menu";
import { Popover, PopoverPopup } from "@/design-system/ui/popover";
import { useBulkActions } from "../actions/use-bulk-actions";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { openDatePicker } from "../lib/date-picker-store";
import { fieldHeld } from "../lib/field-value";
import {
  closeFieldPicker,
  openFieldPicker,
  useOpenFieldPicker,
} from "../lib/field-picker-store";
import { SELECTION } from "../lib/selection-store";
import { useSelectedTasks } from "../queries/use-task-queries";
import { SelectionLabelPicker } from "./selection-label-picker";
import { FieldValueItems } from "./field-value-items";
import {
  AssigneeItems,
  ColumnItems,
  DueDateItems,
  PriorityItems,
} from "./task-field-items";
import { TaskLabelPicker } from "./task-label-picker";
import { useTaskView } from "./task-view-context";

/**
 * The one dropdown behind every field chip and field shortcut. It hangs from
 * the element that opened it, shows that field's choices and applies the pick.
 */
export function TaskFieldPicker() {
  const picker = useOpenFieldPicker();
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const { project, columns, fields, people, meId, today, timeZone, can } =
    useTaskView();
  // The selection picks for several tasks, so no value is shown as current.
  const forSelection = picker?.taskId === SELECTION;
  const selected = useSelectedTasks(project.id);
  const task: TaskRow | undefined = forSelection
    ? selected[0]
    : picker
      ? taskCollection.get(picker.taskId)
      : undefined;

  function choose(apply: () => unknown) {
    const anchor = picker?.anchor;
    closeFieldPicker();
    void apply();
    // The menu returns focus to nothing; the card or chip it hung from takes it.
    requestAnimationFrame(() => {
      if (anchor instanceof HTMLElement && anchor.isConnected) anchor.focus();
    });
  }

  // One custom Field has nothing to choose between, so it opens on its values.
  const pickedField =
    picker?.field === "fields"
      ? fields.find(
          (field) =>
            field.id ===
            (picker.fieldId ?? (fields.length === 1 ? field.id : "")),
        )
      : undefined;

  if (picker?.field === "labels" && task) {
    return (
      <Popover
        open
        onOpenChange={(open) => {
          if (!open) {
            const anchor = picker.anchor;
            closeFieldPicker();
            requestAnimationFrame(() => {
              if (anchor instanceof HTMLElement && anchor.isConnected) {
                anchor.focus();
              }
            });
          }
        }}
      >
        <PopoverPopup anchor={picker.anchor}>
          {forSelection ? (
            <SelectionLabelPicker />
          ) : (
            <TaskLabelPicker taskId={task.id} />
          )}
        </PopoverPopup>
      </Popover>
    );
  }

  return (
    <Menu
      open={picker !== null && task !== undefined}
      onOpenChange={(open) => {
        if (!open) closeFieldPicker();
      }}
    >
      <MenuPopup anchor={picker?.anchor} align="start" className="min-w-48">
        {picker && task ? (
          <>
            {picker.field === "priority" ? (
              <PriorityItems
                value={forSelection ? undefined : task.priority}
                onSelect={(priority) =>
                  choose(() =>
                    forSelection
                      ? bulk.setPriority(priority)
                      : actions.setPriority(task, priority),
                  )
                }
              />
            ) : null}
            {picker.field === "column" ? (
              <ColumnItems
                columns={columns}
                value={forSelection ? undefined : task.columnId}
                onSelect={(columnId) =>
                  choose(() =>
                    forSelection
                      ? bulk.setColumn(columnId)
                      : actions.setColumn(task, columnId),
                  )
                }
              />
            ) : null}
            {picker.field === "assignee" ? (
              <AssigneeItems
                people={people}
                meId={meId}
                canAssign={can.assign}
                value={forSelection ? undefined : task.assigneeId}
                onSelect={(assigneeId) =>
                  choose(() =>
                    forSelection
                      ? bulk.setAssignee(assigneeId)
                      : actions.setAssignee(task, assigneeId),
                  )
                }
              />
            ) : null}
            {picker.field === "fields" && !pickedField
              ? fields.map((field) => (
                  <MenuItem
                    key={field.id}
                    closeOnClick={false}
                    onClick={() =>
                      openFieldPicker(
                        task.id,
                        "fields",
                        picker.anchor,
                        field.id,
                      )
                    }
                  >
                    {field.name}
                  </MenuItem>
                ))
              : null}
            {pickedField ? (
              <FieldValueItems
                field={pickedField}
                value={fieldHeld(pickedField, task.fieldValues)}
                onSelect={(value) => {
                  // A multi choice stays open for the next option.
                  if (pickedField.type === "multi_choice") {
                    void actions.setFieldValue(task, pickedField.id, value);
                  } else {
                    choose(() =>
                      actions.setFieldValue(task, pickedField.id, value),
                    );
                  }
                }}
              />
            ) : null}
            {picker.field === "dueDate" ? (
              <DueDateItems
                today={today}
                timeZone={timeZone}
                hasValue={
                  forSelection
                    ? selected.some((t) => t.dueAt !== null)
                    : task.dueAt !== null
                }
                onSelect={(dueDate) =>
                  choose(() =>
                    forSelection
                      ? bulk.setDueDate(dueDate)
                      : actions.setDueDate(task, dueDate),
                  )
                }
                onPickDate={() =>
                  choose(() =>
                    openDatePicker(forSelection ? SELECTION : task.id),
                  )
                }
              />
            ) : null}
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
