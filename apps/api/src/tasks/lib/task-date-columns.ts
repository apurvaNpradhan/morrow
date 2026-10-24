import { formatTaskDate, parseTaskDate } from "@morrow/sync-schemas";

/**
 * The due date's columns for its text form (`YYYY-MM-DD` or ISO 8601, already
 * validated by `taskDateText`); null clears it.
 */
export function dueColumns(text: string | null) {
  const date = text === null ? null : parseTaskDate(text);
  return { dueAt: date?.at ?? null, dueHasTime: date?.hasTime ?? false };
}

/** The due date's text form, as history, MCP and export write it. */
export function dueText(task: { dueAt: Date | null; dueHasTime: boolean }) {
  return formatTaskDate(task.dueAt, task.dueHasTime);
}

/** `text` in the form `dueText` gives, so a write can tell whether it changed. */
export function normalTaskDate(text: string | null) {
  const date = text === null ? null : parseTaskDate(text);
  return date ? formatTaskDate(date.at, date.hasTime) : null;
}
