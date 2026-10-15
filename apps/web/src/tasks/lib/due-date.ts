import { daysBetween } from "./calendar-day";

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

/** Overdue by the local calendar, and not finished. */
export function isOverdue(
  task: { dueDate: string | null; completedAt: Date | null },
  today: string,
) {
  return (
    task.dueDate !== null && task.completedAt === null && task.dueDate < today
  );
}
