/**
 * What Tasks are made of, shared by the API (which validates writes) and the
 * web app (which renders them).
 */

/** Weakest to strongest; the order is the sort order of "Priority". */
export const TASK_PRIORITIES = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** A cuid2 as the browser generates it when it creates a Task. */
export const TASK_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;

export const TASK_TITLE_MAX = 500;
export const TASK_DESCRIPTION_MAX = 100_000;

/** A calendar day, `YYYY-MM-DD`; due dates are never timestamps. */
export const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `value` is a real calendar day (no February 30th). */
export function isCalendarDate(value: string) {
  if (!DUE_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Columns of these categories hold finished work. */
export function isClosedCategory(category: string) {
  return category === "done" || category === "canceled";
}

/**
 * What a write that puts a Task in a Column does to `completedAt`: stamp it on
 * entering a closed Column, clear it on leaving one, keep it between two.
 */
export function nextCompletedAt(
  completedAt: Date | null,
  from: string,
  to: string,
  now: Date,
): Date | null {
  const closing = isClosedCategory(to);
  if (!closing) return null;
  return isClosedCategory(from) && completedAt ? completedAt : now;
}

/** `KEY-12` as shown and linked; the number is the Project's counter. */
export function ticketId(key: string, number: number) {
  return `${key}-${number}`;
}

/** The key and number of a ticket id, or null when it is not one. */
export function parseTicketId(
  value: string,
): { key: string; number: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]{1,5})-([1-9]\d{0,8})$/.exec(
    value.trim(),
  );
  if (!match) return null;
  return { key: match[1]!.toUpperCase(), number: Number(match[2]) };
}
