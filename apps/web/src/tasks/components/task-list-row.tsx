import { isClosedCategory, type TaskRow } from "@morrow/sync-schemas";
import { CalendarDays, MessageSquare } from "lucide-react";
import { LabelChips, labelsOfTask } from "@/labels";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import type { SubTaskView } from "@/app/preferences/device-preferences-collection";
import { cn } from "@/design-system/cn";
import { isOverdue } from "../lib/due-date";
import {
  keepTextUnselectedOnShiftClick,
  selectByClick,
} from "../lib/select-gesture";
import { useIsSelected } from "../lib/selection-store";
import { TaskSelectBox } from "./task-select-box";
import { openFieldPicker } from "../lib/field-picker-store";
import { displayTicketId } from "../lib/task-links";
import { ColumnMarker } from "./column-marker";
import { DueDateText } from "./due-date-chip-text";
import { FieldValueChips } from "./field-value-chips";
import { PersonAvatar } from "./person-avatar";
import { TaskChip } from "./task-chip";
import { TaskPriorityIcon } from "./task-priority-icon";
import { TaskStructureChips } from "./task-structure-chips";
import { preloadTaskDescriptionEditor } from "./task-description-editor";
import { useTaskView } from "./task-view-context";

/**
 * A task in the list: priority, ticket id, title, due
 * date and assignee, the same facts as a card on one line. In the task sheet's
 * sub-task list (`subTask`) it is indented by `depth`, shows what that list's
 * view switches on, and a Shift-click toggles instead of extending a range.
 */
export function TaskListRow({
  task,
  rowRef,
  dragging = false,
  lifted = false,
  subTask,
}: {
  task: TaskRow;
  /** The sortable's ref, so the row itself is what is picked up. */
  rowRef?: Ref<HTMLDivElement>;
  /** The task being dragged: its place in the lane, dimmed. */
  dragging?: boolean;
  /** The copy that follows the pointer while it is dragged. */
  lifted?: boolean;
  subTask?: { depth: number; show: SubTaskView["show"] };
}) {
  const { t } = useTranslation("tasks");
  const view = useTaskView();
  const {
    project,
    columnById,
    labelById,
    statusFractions,
    personById,
    can,
    frozen,
    today,
  } = view;
  const display = subTask
    ? {
        numbers: subTask.show.id,
        assignees: subTask.show.assignee,
        dueDates: subTask.show.dueDate,
        priority: subTask.show.priority,
      }
    : view.display;
  const showStatus = subTask?.show.status ?? true;
  const showLabels = subTask?.show.labels ?? true;
  const selected = useIsSelected(project.id, task.id);
  const labels = labelsOfTask(task.labelIds, labelById);
  const column = columnById.get(task.columnId);
  const closed = column ? isClosedCategory(column.category) : false;
  const assignee = task.assigneeId
    ? personById.get(task.assigneeId)
    : undefined;
  const editable = can.edit && !frozen;
  const selectable = editable || (can.delete && !frozen);
  const open = editable
    ? (field: "priority" | "column" | "dueDate") => (anchor: HTMLElement) =>
        openFieldPicker(task.id, field, anchor)
    : undefined;
  const ticket = displayTicketId(project.key, task.number);

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      aria-label={t("card.label", { id: ticket, title: task.title })}
      className={cn(
        "group/task relative flex h-9 cursor-pointer items-center gap-2 px-4 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        !subTask && "border-b",
        selectable && "ps-8",
        closed && "opacity-60",
        dragging && "opacity-40",
        lifted && "bg-card shadow-lg",
        selected && "bg-accent/60",
      )}
      style={
        subTask && subTask.depth > 0
          ? { paddingInlineStart: `${2 + subTask.depth * 1.5}rem` }
          : undefined
      }
      onClick={(event) => {
        // A sub-task list has no range of its own to extend, so Shift toggles.
        const gesture = subTask
          ? {
              ...event,
              ctrlKey: event.ctrlKey || event.shiftKey,
              shiftKey: false,
            }
          : event;
        if (selectable && selectByClick(project.id, task.id, gesture)) return;
        view.openTask(task);
      }}
      onPointerEnter={preloadTaskDescriptionEditor}
      onMouseDown={keepTextUnselectedOnShiftClick}
      onFocus={preloadTaskDescriptionEditor}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          view.openTask(task);
        }
      }}
    >
      {subTask && subTask.depth > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 h-6 w-3 rounded-bl-md border-b border-s"
          style={{ insetInlineStart: `${1.5 + subTask.depth * 1.5}rem` }}
        />
      ) : null}
      {selectable ? (
        <TaskSelectBox
          task={task}
          className="absolute start-3 top-1/2 -translate-y-1/2"
        />
      ) : null}
      {display.priority ? (
        <TaskChip
          label={t(`priority.${task.priority}`)}
          onOpen={open?.("priority")}
        >
          <TaskPriorityIcon priority={task.priority} />
        </TaskChip>
      ) : null}
      {display.numbers ? (
        <span className="w-[calc(var(--ticket-chars,8)*1ch)] shrink-0 font-mono text-xs text-muted-foreground">
          {ticket}
        </span>
      ) : null}
      {column && showStatus ? (
        <TaskChip label={column.name} onOpen={open?.("column")}>
          <ColumnMarker
            column={column}
            fraction={statusFractions.get(column.id)}
          />
        </TaskChip>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-semibold">
        {task.title}
      </span>
      <span className="hidden shrink-0 items-center gap-1 empty:hidden sm:flex">
        {showLabels ? <LabelChips labels={labels} max={2} /> : null}
        {showLabels ? <FieldValueChips task={task} max={2} /> : null}
      </span>
      <TaskStructureChips task={task} closed={closed} />
      {task.commentCount > 0 ? (
        <TaskChip label={t("card.comments", { count: task.commentCount })}>
          <MessageSquare aria-hidden="true" className="size-3" />
          {task.commentCount}
        </TaskChip>
      ) : null}
      {display.dueDates && task.dueDate && !closed ? (
        <TaskChip
          label={t("fields.dueDate")}
          onOpen={open?.("dueDate")}
          tone={isOverdue(task, today) ? "danger" : "default"}
        >
          <CalendarDays aria-hidden="true" className="size-3" />
          <DueDateText dueDate={task.dueDate} today={today} />
        </TaskChip>
      ) : null}
      {display.assignees ? (
        assignee ? (
          <PersonAvatar person={assignee} />
        ) : (
          <span className="size-5 shrink-0" />
        )
      ) : null}
    </div>
  );
}
