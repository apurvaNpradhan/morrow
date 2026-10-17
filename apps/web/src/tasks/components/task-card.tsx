import { isClosedCategory, type TaskRow } from "@morrow/sync-schemas";
import { CalendarDays, ListChecks, MessageSquare } from "lucide-react";
import { LabelChips, labelsOfTask } from "@/labels";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { isOverdue } from "../lib/due-date";
import { openFieldPicker } from "../lib/field-picker-store";
import { displayTicketId } from "../lib/task-links";
import { DueDateText } from "./due-date-chip-text";
import { PersonAvatar } from "./person-avatar";
import { TaskChip } from "./task-chip";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

/**
 * A task on the board. Click or Enter opens it; the chips open their field's
 * picker in place. Finished tasks are muted and show no chips.
 */
export function TaskCard({
  task,
  cardRef,
  dragging = false,
  lifted = false,
}: {
  task: TaskRow;
  /** The sortable's ref, so the card itself is what is picked up. */
  cardRef?: Ref<HTMLDivElement>;
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
    personById,
    display,
    can,
    frozen,
    today,
  } = view;
  const labels = labelsOfTask(task.labelIds, labelById);
  const column = columnById.get(task.columnId);
  const closed = column ? isClosedCategory(column.category) : false;
  const assignee = task.assigneeId
    ? personById.get(task.assigneeId)
    : undefined;
  const progress =
    task.checklistTotal > 0
      ? { done: task.checklistDone, total: task.checklistTotal }
      : null;
  const editable = can.edit && !frozen;
  const open = editable
    ? (field: "priority" | "dueDate") => (anchor: HTMLElement) =>
        openFieldPicker(task.id, field, anchor)
    : undefined;

  const showPriority = display.priority;
  const showDue = display.dueDates && task.dueDate !== null && !closed;
  const showProgress = display.checklist && progress !== null;
  const showComments = task.commentCount > 0;
  const showChips = showPriority || showDue || showProgress || showComments;
  const ticket = displayTicketId(project.key, task.number);

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      aria-label={t("card.label", { id: ticket, title: task.title })}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-2.5 text-left shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        closed && "opacity-60",
        dragging && "opacity-40",
        lifted && "shadow-lg ring-1 ring-ring",
      )}
      onClick={() => view.openTask(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          view.openTask(task);
        }
      }}
    >
      {display.numbers || (display.assignees && assignee) ? (
        <div className="flex items-center justify-between gap-2">
          {display.numbers ? (
            <span className="font-mono text-xs text-muted-foreground">
              {ticket}
            </span>
          ) : (
            <span />
          )}
          {display.assignees && assignee ? (
            <PersonAvatar person={assignee} />
          ) : null}
        </div>
      ) : null}
      <p className="line-clamp-3 break-words text-sm">{task.title}</p>
      {labels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <LabelChips labels={labels} max={3} />
        </div>
      ) : null}
      {showChips ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {showPriority ? (
            <TaskChip
              label={t(`priority.${task.priority}`)}
              onOpen={open?.("priority")}
            >
              <TaskPriorityIcon priority={task.priority} />
            </TaskChip>
          ) : null}
          {showDue && task.dueDate ? (
            <TaskChip
              label={t("fields.dueDate")}
              onOpen={open?.("dueDate")}
              tone={isOverdue(task, today) ? "danger" : "default"}
            >
              <CalendarDays aria-hidden="true" className="size-3" />
              <DueDateText dueDate={task.dueDate} today={today} />
            </TaskChip>
          ) : null}
          {showComments ? (
            <TaskChip label={t("card.comments", { count: task.commentCount })}>
              <MessageSquare aria-hidden="true" className="size-3" />
              {task.commentCount}
            </TaskChip>
          ) : null}
          {showProgress && progress ? (
            <TaskChip label={t("card.checklist")}>
              <ListChecks aria-hidden="true" className="size-3" />
              {progress.done}/{progress.total}
            </TaskChip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
