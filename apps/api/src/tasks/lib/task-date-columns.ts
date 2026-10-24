import { formatTaskDate, parseTaskDate } from "@morrow/sync-schemas";
import { taskError } from "#api/tasks/errors";

/**
 * The start and due dates' columns for their text form (`YYYY-MM-DD` or ISO
 * 8601, already validated by the `dueDate` input schema); null clears one.
 */
export function dueColumns(text: string | null) {
  const date = text === null ? null : parseTaskDate(text);
  return { dueAt: date?.at ?? null, dueHasTime: date?.hasTime ?? false };
}

export function startColumns(text: string | null) {
  const date = text === null ? null : parseTaskDate(text);
  return { startAt: date?.at ?? null, startHasTime: date?.hasTime ?? false };
}

/** The due date's text form, as history, MCP and export write it. */
export function dueText(task: { dueAt: Date | null; dueHasTime: boolean }) {
  return formatTaskDate(task.dueAt, task.dueHasTime);
}

export function startText(task: {
  startAt: Date | null;
  startHasTime: boolean;
}) {
  return formatTaskDate(task.startAt, task.startHasTime);
}

/** `text` in the form `dueText` gives, so a write can tell whether it changed. */
export function normalTaskDate(text: string | null) {
  const date = text === null ? null : parseTaskDate(text);
  return date ? formatTaskDate(date.at, date.hasTime) : null;
}

/** Whether a start date (text form) falls after a due date (text form). A day counts as 00:00 UTC. */
export function startsAfterDue(start: string | null, due: string | null) {
  if (start === null || due === null) return false;
  return parseTaskDate(start)!.at.getTime() > parseTaskDate(due)!.at.getTime();
}

/** Refuses a start date after the due date. */
export function assertSpan(start: string | null, due: string | null) {
  if (startsAfterDue(start, due)) throw taskError("START_AFTER_DUE");
}
