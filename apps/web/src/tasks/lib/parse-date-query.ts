import { addDays, addMonths } from "date-fns";
import { dayString, parseDay } from "./calendar-day";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** The index of a full or three-letter name in `names`, or -1. */
function indexOfName(names: string[], word: string) {
  if (word.length < 3) return -1;
  return names.findIndex((name) => name === word || name.slice(0, 3) === word);
}

/** A real calendar day, or null for `feb 30`. */
function validDay(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  const real =
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day;
  return real ? dayString(date) : null;
}

/** `mon D` or `D mon` this year, or next year once it has passed. */
function monthDay(month: number, day: number, today: string) {
  const year = Number(today.slice(0, 4));
  const thisYear = validDay(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return validDay(year + 1, month, day);
}

/**
 * An English date query ("fri", "in 3 days", "nov 3", "2026-11-03") as a
 * `YYYY-MM-DD` day relative to `today`, or null when it is not understood.
 * A bare weekday is its next occurrence and never today.
 */
export function parseDateQuery(query: string, today: string): string | null {
  const text = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  const base = parseDay(today);

  if (text === "today") return today;
  if (text === "tomorrow") return dayString(addDays(base, 1));
  if (text === "yesterday") return dayString(addDays(base, -1));

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const relative = /^in (\d+) (day|week|month)s?$/.exec(text);
  if (relative) {
    const amount = Number(relative[1]);
    if (relative[2] === "day") return dayString(addDays(base, amount));
    if (relative[2] === "week") return dayString(addDays(base, amount * 7));
    return dayString(addMonths(base, amount));
  }

  const weekday = /^(next )?([a-z]+)$/.exec(text);
  if (weekday) {
    const index = indexOfName(WEEKDAYS, weekday[2]!);
    if (index >= 0) {
      const ahead = (index - base.getDay() + 7) % 7 || 7;
      return dayString(addDays(base, ahead + (weekday[1] ? 7 : 0)));
    }
  }

  const monthFirst = /^([a-z]+) (\d{1,2})$/.exec(text);
  if (monthFirst) {
    const month = indexOfName(MONTHS, monthFirst[1]!);
    if (month >= 0) return monthDay(month, Number(monthFirst[2]), today);
  }
  const dayFirst = /^(\d{1,2}) ([a-z]+)$/.exec(text);
  if (dayFirst) {
    const month = indexOfName(MONTHS, dayFirst[2]!);
    if (month >= 0) return monthDay(month, Number(dayFirst[1]), today);
  }

  return null;
}
