import type { TaskRow } from "@morrow/sync-schemas";
import {
  Archive,
  ArchiveRestore,
  CalendarArrowDown,
  CalendarDays,
  Copy,
  FolderInput,
  Trash2,
  UserRound,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@/design-system/ui/context-menu";
import {
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/design-system/ui/menu";
import { MenuHint } from "@/design-system/tooltip-label";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { useSelectedIds } from "../lib/selection-store";
import { SelectionMenuItems } from "./selection-menu-items";
import { openDatePicker } from "../lib/date-picker-store";
import { dueDay } from "../lib/due-date";
import { requestMoveTasks } from "../lib/move-store";
import { requestDeleteTasks } from "./delete-task-dialog";
import { ColumnMarker } from "./column-marker";
import {
  AssigneeItems,
  ColumnItems,
  TaskDateItems,
  PriorityItems,
} from "./task-field-items";
import { TaskCopyItems } from "./task-copy-items";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

/**
 * Right-click on a card or row: copy it, change any field, duplicate,
 * archive or delete. One menu serves the whole board or list: it opens for
 * whichever task was clicked, so no card or row carries a menu of its own, and
 * it stays open when its task scrolls out of view. Items follow what the user
 * may do.
 */
export function TaskContextMenu({
  children,
  extraItems,
}: {
  children: ReactNode;
  /** More items for a single task, after its field actions: the sheet's sub-task list adds its own. */
  extraItems?: (task: TaskRow) => ReactNode;
}) {
  const { project, can, frozen } = useTaskView();
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = taskId ? taskCollection.get(taskId) : undefined;
  // A task inside the selection acts for all of it; any other acts alone and leaves the selection be.
  const selection = useSelectedIds(project.id);
  const forSelection =
    taskId !== null &&
    selection.has(taskId) &&
    (can.edit || can.delete) &&
    !frozen;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="h-full"
        onContextMenuCapture={(event) => {
          const id =
            event.target instanceof Element
              ? event.target.closest<HTMLElement>("[data-task-id]")?.dataset
                  .taskId
              : undefined;
          // Anywhere but a task keeps the browser's own menu.
          if (id) setTaskId(id);
          else event.stopPropagation();
        }}
      >
        {children}
      </ContextMenuTrigger>
      {task ? (
        <ContextMenuPopup>
          {forSelection ? (
            <SelectionMenuItems
              anchor={document.querySelector(`[data-task-id="${task.id}"]`)}
            />
          ) : (
            <TaskMenuItems task={task} extraItems={extraItems} />
          )}
        </ContextMenuPopup>
      ) : null}
    </ContextMenu>
  );
}

function TaskMenuItems({
  task,
  extraItems,
}: {
  task: TaskRow;
  extraItems?: (task: TaskRow) => ReactNode;
}) {
  const { t } = useTranslation("tasks");
  const { columns, columnById, people, meId, today, timeZone, can, frozen } =
    useTaskView();
  const actions = useTaskActions();
  const column = columnById.get(task.columnId);
  const editable = can.edit && !frozen;

  return (
    <>
      <MenuSub>
        <MenuSubTrigger>
          <Copy aria-hidden="true" />
          {t("copy.group")}
        </MenuSubTrigger>
        <MenuSubPopup>
          <TaskCopyItems task={task} />
        </MenuSubPopup>
      </MenuSub>
      {editable ? (
        <>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger>
              <TaskPriorityIcon priority={task.priority} />
              {t("fields.priority")}
              <MenuHint hotkeyId="setTaskPriority" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <PriorityItems
                value={task.priority}
                onSelect={(priority) =>
                  void actions.setPriority(task, priority)
                }
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>
              {column ? <ColumnMarker column={column} /> : null}
              {t("fields.column")}
              <MenuHint hotkeyId="setTaskColumn" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <ColumnItems
                columns={columns}
                value={task.columnId}
                onSelect={(columnId) => void actions.setColumn(task, columnId)}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>
              <CalendarArrowDown aria-hidden="true" />
              {t("fields.startDate")}
              <MenuHint hotkeyId="setTaskStartDate" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <TaskDateItems
                today={today}
                timeZone={timeZone}
                hasValue={task.startAt !== null}
                latest={dueDay(task, timeZone) ?? undefined}
                onSelect={(startDate) =>
                  void actions.setStartDate(task, startDate)
                }
                onPickDate={() => openDatePicker(task.id, "startDate")}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>
              <CalendarDays aria-hidden="true" />
              {t("fields.dueDate")}
              <MenuHint hotkeyId="setTaskDueDate" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <TaskDateItems
                today={today}
                timeZone={timeZone}
                hasValue={task.dueAt !== null}
                onSelect={(dueDate) => void actions.setDueDate(task, dueDate)}
                onPickDate={() => openDatePicker(task.id, "dueDate")}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>
              <UserRound aria-hidden="true" />
              {t("fields.assignee")}
              <MenuHint hotkeyId="assignTask" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <AssigneeItems
                people={people}
                meId={meId}
                canAssign={can.assign}
                value={task.assigneeId}
                onSelect={(assigneeId) =>
                  void actions.setAssignee(task, assigneeId)
                }
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSeparator />
          {extraItems?.(task)}
          {can.create ? (
            <MenuItem onClick={() => void actions.duplicate(task)}>
              <Copy aria-hidden="true" />
              {t("menu.duplicate")}
            </MenuItem>
          ) : null}
          {can.create ? (
            <MenuItem onClick={() => requestMoveTasks([task])}>
              <FolderInput aria-hidden="true" />
              {t("menu.moveToProject")}
              <MenuHint hotkeyId="moveTask" />
            </MenuItem>
          ) : null}
          {task.archivedAt ? (
            <MenuItem onClick={() => void actions.unarchive(task)}>
              <ArchiveRestore aria-hidden="true" />
              {t("menu.unarchive")}
            </MenuItem>
          ) : (
            <MenuItem onClick={() => void actions.archive(task)}>
              <Archive aria-hidden="true" />
              {t("menu.archive")}
            </MenuItem>
          )}
        </>
      ) : null}
      {can.delete && !frozen ? (
        <MenuItem
          variant="destructive"
          onClick={() => requestDeleteTasks([task])}
        >
          <Trash2 aria-hidden="true" />
          {t("menu.delete")}
          <MenuHint hotkeyId="deleteTask" />
        </MenuItem>
      ) : null}
    </>
  );
}
