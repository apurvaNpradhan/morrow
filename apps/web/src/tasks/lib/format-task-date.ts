import {
  momentInZone,
  parseTaskDate,
  taskDateDay,
  timeInZone,
} from "@morrow/sync-schemas";
import { formatDate } from "@/design-system/format";
import { parseDay } from "./calendar-day";

/** The time of day of `at` in `timeZone`, as the locale writes it: `3:00 PM`. */
export function formatTaskTime(at: Date, timeZone: string) {
  return formatDate(at, { hour: "numeric", minute: "2-digit", timeZone });
}

/** `Oct 24`, then `, 3:00 PM` in `timeZone` for a moment. A day reads the same everywhere. */
export function formatTaskDate(
  at: Date,
  hasTime: boolean,
  timeZone: string,
  { year = false }: { year?: boolean } = {},
) {
  const day = formatDate(parseDay(taskDateDay(at, hasTime, timeZone)), {
    month: "short",
    day: "numeric",
    ...(year && { year: "numeric" }),
  });
  if (!hasTime) return day;
  return `${day}, ${formatTaskTime(at, timeZone)}`;
}

/** The text form of a date (`YYYY-MM-DD` or ISO) the way `formatTaskDate` reads it; "" when it is not a date. */
export function formatTaskDateText(
  text: string,
  timeZone: string,
  options?: { year?: boolean },
) {
  const date = parseTaskDate(text);
  return date ? formatTaskDate(date.at, date.hasTime, timeZone, options) : "";
}

/** A day, plus an optional `HH:MM` in `timeZone`, as the text the API takes: a day, or ISO UTC. */
export function taskDateText(
  day: string,
  time: string | undefined,
  timeZone: string,
) {
  return time ? momentInZone(day, time, timeZone).toISOString() : day;
}

/** The day and `HH:MM` (empty for a day) in `timeZone` that a date's text form holds, for a date and a time input. */
export function splitTaskDateText(text: string | null, timeZone: string) {
  const date = text === null ? null : parseTaskDate(text);
  if (!date) return { day: "", time: "" };
  return {
    day: taskDateDay(date.at, date.hasTime, timeZone),
    time: date.hasTime ? timeInZone(date.at, timeZone) : "",
  };
}
