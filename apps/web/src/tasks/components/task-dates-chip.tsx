import { taskDateDay } from "@morrow/sync-schemas";
import { CalendarArrowDown, CalendarDays, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "@morrow/sync-schemas";
import { isOverdue } from "../lib/due-date";
import { formatTaskDate } from "../lib/format-task-date";
import { recurrenceSummary } from "../lib/recurrence-summary";
import { DueDateText } from "./due-date-chip-text";
import { TaskChip } from "./task-chip";

/**
 * The dates of a card or row as one chip: `Oct 20 → Oct 24` (with times where
 * set), the due date alone in words ("Tomorrow"), or "Starts Oct 20". It turns
 * red when the due date has passed. Clicking opens the due date's picker, or
 * the start date's when that is all there is.
 */
function DatesChip({
  task,
  showStart,
  showDue,
  today,
  timeZone,
  open,
}: {
  task: TaskRow;
  showStart: boolean;
  showDue: boolean;
  today: string;
  timeZone: string;
  open:
    | ((field: "startDate" | "dueDate") => (anchor: HTMLElement) => void)
    | undefined;
}) {
  const { t } = useTranslation("tasks");
  const start = showStart ? task.startAt : null;
  const due = showDue ? task.dueAt : null;
  const date = (at: Date, hasTime: boolean) =>
    formatTaskDate(at, hasTime, timeZone, {
      year:
        taskDateDay(at, hasTime, timeZone).slice(0, 4) !== today.slice(0, 4),
    });

  if (due && start) {
    return (
      <TaskChip
        label={`${t("fields.startDate")} → ${t("fields.dueDate")}`}
        onOpen={open?.("dueDate")}
        tone={isOverdue(task, today, timeZone) ? "danger" : "default"}
      >
        <CalendarDays aria-hidden="true" className="size-3" />
        {date(start, task.startHasTime)} → {date(due, task.dueHasTime)}
      </TaskChip>
    );
  }
  if (due) {
    return (
      <TaskChip
        label={t("fields.dueDate")}
        onOpen={open?.("dueDate")}
        tone={isOverdue(task, today, timeZone) ? "danger" : "default"}
      >
        <CalendarDays aria-hidden="true" className="size-3" />
        <DueDateText
          dueAt={due}
          dueHasTime={task.dueHasTime}
          today={today}
          timeZone={timeZone}
        />
      </TaskChip>
    );
  }
  if (start) {
    return (
      <TaskChip label={t("fields.startDate")} onOpen={open?.("startDate")}>
        <CalendarArrowDown aria-hidden="true" className="size-3" />
        {t("card.starts", { date: date(start, task.startHasTime) })}
      </TaskChip>
    );
  }
  return null;
}

/** The dates chip, and next to it a repeat mark when the task repeats. */
export function TaskDatesChip(props: Parameters<typeof DatesChip>[0]) {
  const summary = props.showDue ? recurrenceSummary(props.task) : null;
  return (
    <>
      <DatesChip {...props} />
      {summary ? (
        <TaskChip label={summary}>
          <Repeat aria-hidden="true" className="size-3" />
        </TaskChip>
      ) : null}
    </>
  );
}
