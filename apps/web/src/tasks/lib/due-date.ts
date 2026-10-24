import {
  formatTaskDate,
  parseTaskDate,
  taskDateDay,
} from "@morrow/sync-schemas";
import { daysBetween } from "./calendar-day";

type Due = { dueAt: Date | null; dueHasTime: boolean };
type Start = { startAt: Date | null; startHasTime: boolean };

export type DueLabel =
  | { kind: "overdueDays"; count: number }
  | { kind: "overdueWeeks"; count: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "inDays"; count: number }
  | { kind: "date"; day: string };

/**
 * How a due date reads next to `today` (both `YYYY-MM-DD`): "3d overdue",
 * "2w overdue", "Today", "Tomorrow", "In 4 days", else the date itself.
 */
export function dueLabel(dueDate: string, today: string): DueLabel {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) {
    const late = -diff;
    return late < 14
      ? { kind: "overdueDays", count: late }
      : { kind: "overdueWeeks", count: Math.floor(late / 7) };
  }
  if (diff === 0) return { kind: "today" };
  if (diff === 1) return { kind: "tomorrow" };
  if (diff < 7) return { kind: "inDays", count: diff };
  return { kind: "date", day: dueDate };
}

/** The day a task starts on in `timeZone` (`YYYY-MM-DD`), or null. */
export function startDay(task: Start, timeZone: string) {
  return task.startAt
    ? taskDateDay(task.startAt, task.startHasTime, timeZone)
    : null;
}

/** The day a task is due on in `timeZone` (`YYYY-MM-DD`), or null. */
export function dueDay(task: Due, timeZone: string) {
  return task.dueAt ? taskDateDay(task.dueAt, task.dueHasTime, timeZone) : null;
}

/** The task columns for a start date's text form (`YYYY-MM-DD` or ISO); null clears it. */
export function startFields(text: string | null): Start {
  const date = text === null ? null : parseTaskDate(text);
  return { startAt: date?.at ?? null, startHasTime: date?.hasTime ?? false };
}

/** A task's start date as text (`YYYY-MM-DD` or ISO), as the API takes it. */
export function startText(task: Start) {
  return formatTaskDate(task.startAt, task.startHasTime);
}

/** Whether the start date falls after the due date (a day counts as 00:00 UTC). */
export function startsAfterDue(task: Start & Due) {
  return (
    task.startAt !== null &&
    task.dueAt !== null &&
    task.startAt.getTime() > task.dueAt.getTime()
  );
}

/** The task columns for a due date's text form (`YYYY-MM-DD` or ISO); null clears it. */
export function dueFields(text: string | null): Due {
  const date = text === null ? null : parseTaskDate(text);
  return { dueAt: date?.at ?? null, dueHasTime: date?.hasTime ?? false };
}

/** A task's due date as text (`YYYY-MM-DD` or ISO), as the API takes it. */
export function dueText(task: Due) {
  return formatTaskDate(task.dueAt, task.dueHasTime);
}

/**
 * Not finished and past due: a day once it has ended in `timeZone`, a moment
 * once it has passed.
 */
export function isOverdue(
  task: Due & { completedAt: Date | null },
  today: string,
  timeZone: string,
  now = new Date(),
) {
  if (task.dueAt === null || task.completedAt !== null) return false;
  if (task.dueHasTime) return task.dueAt.getTime() < now.getTime();
  return dueDay(task, timeZone)! < today;
}
