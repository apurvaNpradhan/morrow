import { addDays, addMonths } from "date-fns";
import { addDaysTo, dayString, parseDay } from "./calendar-day";

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

function parseDayQuery(text: string, today: string): string | null {
  if (!text) return null;
  const base = parseDay(today);

  if (text === "today") return today;
  if (text === "tomorrow") return dayString(addDays(base, 1));
  if (text === "yesterday") return dayString(addDays(base, -1));

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // "in 3 days", "7 days", "2w", "24h" (hours round up to whole days).
  const relative =
    /^(?:in )?(\d+) ?(h|hr|hrs|hours?|d|days?|w|wks?|weeks?|mo|months?)$/.exec(
      text,
    );
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2]!;
    if (unit.startsWith("h"))
      return dayString(addDays(base, Math.ceil(amount / 24)));
    if (unit.startsWith("d")) return dayString(addDays(base, amount));
    if (unit.startsWith("w")) return dayString(addDays(base, amount * 7));
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

/** A day, and a wall-clock time (`HH:MM`) when the query named one. */
export type DateQuery = { day: string; time?: string };

const TIME = "noon|\\d{1,2}(?::\\d{2})? ?(?:am|pm)|\\d{1,2}:\\d{2}";
const TRAILING_TIME = new RegExp(`^(.*?\\S)(?: at)? (${TIME})$`);
const WHOLE_TIME = new RegExp(`^(?:at )?(${TIME})$`);

/** `3pm`, `3:30 pm`, `15:30` or `noon` as `HH:MM`, or null. */
function parseTime(text: string) {
  if (text === "noon") return "12:00";
  const meridiem = /^(\d{1,2})(?::(\d{2}))? ?(am|pm)$/.exec(text);
  if (meridiem) {
    const hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const hour24 = (hour % 12) + (meridiem[3] === "pm" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const clock = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!clock || Number(clock[1]) > 23 || Number(clock[2]) > 59) return null;
  return `${clock[1]!.padStart(2, "0")}:${clock[2]}`;
}

/**
 * An English date query ("fri", "in 3 days", "nov 3", "2026-11-03", "fri 3pm",
 * "tomorrow 09:00", "15:30") as a day relative to `today`, with a time when
 * the query has one. A bare weekday is its next occurrence and never today. A
 * time alone means today, or tomorrow once `now` (`HH:MM` in the user's zone)
 * has passed it. Null when the query is not understood.
 */
export function parseDateQuery(
  query: string,
  today: string,
  now?: string,
): DateQuery | null {
  const text = query.trim().toLowerCase().replace(/\s+/g, " ");
  const alone = WHOLE_TIME.exec(text);
  if (alone) {
    const time = parseTime(alone[1]!);
    if (time === null) return null;
    const passed = now !== undefined && time <= now;
    return { day: passed ? addDaysTo(today, 1) : today, time };
  }
  const trailing = TRAILING_TIME.exec(text);
  if (trailing) {
    const time = parseTime(trailing[2]!);
    const day = parseDayQuery(trailing[1]!, today);
    return time !== null && day !== null ? { day, time } : null;
  }
  const day = parseDayQuery(text, today);
  return day === null ? null : { day };
}
