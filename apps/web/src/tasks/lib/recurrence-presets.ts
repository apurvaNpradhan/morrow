import {
  buildRecurrence,
  recurrenceText,
  taskDateDay,
  WEEKDAY_CODES,
  type RecurrenceOptions,
  type TaskDate,
  type WeekdayCode,
} from "@morrow/sync-schemas";

/** The ready-made repeats a due date offers; each is a rule built from the date. */
export const RECURRENCE_PRESETS = [
  "daily",
  "weekdays",
  "weekly",
  "monthlyDay",
  "monthlyNth",
  "yearly",
] as const;
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

/** What a due date says about its own day, in `timeZone`. */
export function dayFacts(due: TaskDate, timeZone: string) {
  const day = taskDateDay(due.at, due.hasTime, timeZone);
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  // 0 is Monday, matching WEEKDAY_CODES.
  const weekday =
    (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
  const nth = Math.ceil(date / 7);
  return {
    day,
    year,
    month,
    date,
    weekday: WEEKDAY_CODES[weekday] as WeekdayCode,
    /** The weekday's place in its month: 1 to 4, and -1 for the last one. */
    nth: nth === 5 ? -1 : nth,
  };
}

/** The options of a preset, for a due date. */
export function presetOptions(
  preset: RecurrencePreset,
  due: TaskDate,
  timeZone: string,
): RecurrenceOptions {
  const facts = dayFacts(due, timeZone);
  switch (preset) {
    case "daily":
      return { freq: "DAILY" };
    case "weekdays":
      return {
        freq: "WEEKLY",
        byDay: WEEKDAY_CODES.slice(0, 5).map((day) => ({ day })),
      };
    case "weekly":
      return { freq: "WEEKLY", byDay: [{ day: facts.weekday }] };
    case "monthlyDay":
      return { freq: "MONTHLY", byMonthDay: [facts.date] };
    case "monthlyNth":
      return {
        freq: "MONTHLY",
        byDay: [{ day: facts.weekday, nth: facts.nth }],
      };
    case "yearly":
      return {
        freq: "YEARLY",
        byMonth: [facts.month],
        byMonthDay: [facts.date],
      };
  }
}

/** The rule text for options on a due date, written in `timeZone` when the date has a time. */
export function ruleText(
  options: RecurrenceOptions,
  due: TaskDate,
  timeZone: string,
) {
  return recurrenceText(buildRecurrence(options, due, timeZone));
}
