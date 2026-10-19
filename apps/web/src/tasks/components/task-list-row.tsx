import { isClosedCategory, type TaskRow } from "@morrow/sync-schemas";
import { CalendarDays, MessageSquare } from "lucide-react";
import { LabelChips, labelsOfTask } from "@/labels";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { isOverdue } from "../lib/due-date";
import { selectByClick } from "../lib/select-gesture";
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
import { useTaskView } from "./task-view-context";

/**
 * A task in the list: priority, ticket id, title with checklist progress, due
 * date and assignee, the same facts as a card on one line.
 */
export function TaskListRow({
  task,
  rowRef,
  dragging = false,
  lifted = false,
}: {
  task: TaskRow;
  /** The sortable's ref, so the row itself is what is picked up. */
  rowRef?: Ref<HTMLDivElement>;
  /** The task being dragged: its place in the lane, dimmed. */
  dragging?: boolean;
  /** The copy that follows the pointer while it is dragged. */
  lifted?: boolean;
}) {
  const { t } = useTranslation("tasks");
  const view = useTaskView();
  const {
    project,
    columnById,
    labelById,
    statusFractions,
    personById,
    display,
    can,
    frozen,
    today,
  } = view;
  const selected = useIsSelected(project.id, task.id);
  const labels = labelsOfTask(task.labelIds, labelById);
  const column = columnById.get(task.columnId);
  const closed = column ? isClosedCategory(column.category) : false;
  const assignee = task.assigneeId
    ? personById.get(task.assigneeId)
    : undefined;
  const progress =
    display.checklist && task.checklistTotal > 0
      ? { done: task.checklistDone, total: task.checklistTotal }
      : null;
  const editable = can.edit && !frozen;
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
        "group/task relative flex h-9 cursor-pointer items-center gap-2 border-b px-4 text-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        closed && "opacity-60",
        dragging && "opacity-40",
        lifted && "bg-card shadow-lg",
        selected && "bg-accent/60",
      )}
      onClick={(event) => {
        if (selectByClick(project.id, task.id, event)) return;
        view.openTask(task);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          view.openTask(task);
        }
      }}
    >
      {editable || can.delete ? (
        <TaskSelectBox
          task={task}
          className="absolute start-1 top-1/2 -translate-y-1/2"
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
      {column ? (
        <TaskChip label={column.name} onOpen={open?.("column")}>
          <ColumnMarker
            column={column}
            fraction={statusFractions.get(column.id)}
          />
        </TaskChip>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-semibold">
        {task.title}
        {progress ? (
          <span className="ms-2 text-xs tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        ) : null}
      </span>
      <span className="hidden shrink-0 items-center gap-1 empty:hidden sm:flex">
        <LabelChips labels={labels} max={2} />
        <FieldValueChips task={task} max={2} />
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
