import { Menu, MenuPopup } from "@/design-system/ui/menu";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { openDatePicker } from "../lib/date-picker-store";
import {
  closeFieldPicker,
  useOpenFieldPicker,
} from "../lib/field-picker-store";
import {
  AssigneeItems,
  ColumnItems,
  DueDateItems,
  PriorityItems,
} from "./task-field-items";
import { useTaskView } from "./task-view-context";

/**
 * The one dropdown behind every field chip and field shortcut. It hangs from
 * the element that opened it, shows that field's choices and applies the pick.
 */
export function TaskFieldPicker() {
  const picker = useOpenFieldPicker();
  const actions = useTaskActions();
  const { columns, people, meId, today, can } = useTaskView();
  const task = picker ? taskCollection.get(picker.taskId) : undefined;

  function choose(apply: () => unknown) {
    const anchor = picker?.anchor;
    closeFieldPicker();
    void apply();
    // The menu returns focus to nothing; the card or chip it hung from takes it.
    requestAnimationFrame(() => {
      if (anchor instanceof HTMLElement && anchor.isConnected) anchor.focus();
    });
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
                value={task.priority}
                onSelect={(priority) =>
                  choose(() => actions.setPriority(task, priority))
                }
              />
            ) : null}
            {picker.field === "column" ? (
              <ColumnItems
                columns={columns}
                value={task.columnId}
                onSelect={(columnId) =>
                  choose(() => actions.setColumn(task, columnId))
                }
              />
            ) : null}
            {picker.field === "assignee" ? (
              <AssigneeItems
                people={people}
                meId={meId}
                canAssign={can.assign}
                value={task.assigneeId}
                onSelect={(assigneeId) =>
                  choose(() => actions.setAssignee(task, assigneeId))
                }
              />
            ) : null}
            {picker.field === "dueDate" ? (
              <DueDateItems
                today={today}
                hasValue={task.dueDate !== null}
                onSelect={(dueDate) =>
                  choose(() => actions.setDueDate(task, dueDate))
                }
                onPickDate={() => choose(() => openDatePicker(task.id))}
              />
            ) : null}
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
