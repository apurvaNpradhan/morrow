import { RRule, Weekday } from "./rrule-module.js";
import {
  isTimeZone,
  momentInZone,
  taskDateDay,
  timeInZone,
  type TaskDate,
} from "./task-dates.js";

/**
 * Recurrence: an RFC 5545 rule (`DTSTART` plus one `RRULE`) on a Task's due
 * date, shared by the API and the web app. Morrow accepts a small subset and
 * does the date arithmetic in "floating" time: the rule's wall clock is read
 * as UTC, so `rrule` never touches a time zone and a timed rule keeps its
 * wall-clock time across daylight-saving changes. The zone is applied last, by
 * `momentInZone`.
 */

export const RECURRENCE_INTERVAL_MAX = 99;
export const RECURRENCE_COUNT_MAX = 999;
export const RECURRENCE_TEXT_MAX = 400;

const FREQUENCIES = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
} as const;
export type RecurrenceFrequency = keyof typeof FREQUENCIES;

const WEEKDAYS = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
];
export const WEEKDAY_CODES = [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

const ALLOWED_PARTS = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYMONTHDAY",
  "BYMONTH",
  "UNTIL",
  "COUNT",
]);

/** Why a rule text was refused; the API turns each into a typed error. */
export type RecurrenceProblem =
  | "SYNTAX"
  | "UNSUPPORTED_PART"
  | "BAD_FREQUENCY"
  | "BAD_INTERVAL"
  | "BAD_COUNT"
  | "UNTIL_AND_COUNT"
  | "BAD_UNTIL"
  | "BAD_BYDAY"
  | "ORDINAL_NOT_MONTHLY"
  | "BAD_BYMONTHDAY"
  | "BAD_BYMONTH"
  | "BAD_TIME_ZONE"
  | "DTSTART_MISMATCH";

/**
 * A rule. `start` is the due date it begins on; `zone` is the IANA zone of a
 * timed rule (its `TZID`), null for a rule on days.
 */
export type Recurrence = {
  rule: RRule;
  start: TaskDate;
  zone: string | null;
};

export type ParsedRecurrence =
  | { ok: true; recurrence: Recurrence }
  | { ok: false; reason: RecurrenceProblem };

const refuse = (reason: RecurrenceProblem): ParsedRecurrence => ({
  ok: false,
  reason,
});

/** A wall-clock day and time as a UTC `Date`: the floating form `rrule` computes in. */
function floating(day: string, time = "00:00") {
  return new Date(`${day}T${time}:00Z`);
}

const dayOf = (at: Date) => at.toISOString().slice(0, 10);
const timeOf = (at: Date) => at.toISOString().slice(11, 16);

/** The floating form of a date on the rule's clock. */
function floatingOf(date: TaskDate, zone: string | null) {
  if (!date.hasTime || zone === null) return floating(dayOf(date.at));
  return floating(taskDateDay(date.at, true, zone), timeInZone(date.at, zone));
}

/** A floating date back to a day, or to the moment it is on the rule's clock. */
function fromFloating(at: Date, zone: string | null): TaskDate {
  if (zone === null) return { at: floating(dayOf(at)), hasTime: false };
  return { at: momentInZone(dayOf(at), timeOf(at), zone), hasTime: true };
}

const compact = (day: string) => day.replaceAll("-", "");
const spread = (stamp: string) =>
  `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;

function dtstartLine({ start, zone }: Pick<Recurrence, "start" | "zone">) {
  if (zone === null || !start.hasTime) {
    return `DTSTART;VALUE=DATE:${compact(dayOf(start.at))}`;
  }
  const wall = floatingOf(start, zone);
  const clock = timeOf(wall).replace(":", "");
  return `DTSTART;TZID=${zone}:${compact(dayOf(wall))}T${clock}00`;
}

function weekdayOf(token: string): Weekday | null {
  const match = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token);
  if (!match) return null;
  const weekday = WEEKDAYS[WEEKDAY_CODES.indexOf(match[2] as WeekdayCode)]!;
  if (match[1] === undefined) return weekday;
  const nth = Number(match[1]);
  if (nth === 0 || Math.abs(nth) > 5) return null;
  return weekday.nth(nth);
}

function integers(value: string, min: number, max: number) {
  const parts = value.split(",");
  const numbers = parts.map((part) =>
    /^-?\d+$/.test(part) ? Number(part) : Number.NaN,
  );
  const ok = numbers.every(
    (n) => Number.isInteger(n) && n >= min && n <= max && n !== 0,
  );
  return ok ? numbers : null;
}

/**
 * Reads a rule's text and checks it against what Morrow supports and against
 * the Task's due date, which `DTSTART` must equal. The checks are the same in
 * the API and the browser. Without a due date (a rule read out of history) the
 * rule stands on its own `DTSTART`.
 */
export function parseRecurrence(
  text: string,
  due: TaskDate | null,
): ParsedRecurrence {
  if (text.length > RECURRENCE_TEXT_MAX) return refuse("SYNTAX");
  const lines = text.split(/\r?\n/).filter((line) => line !== "");
  if (lines.length !== 2) return refuse("SYNTAX");

  let zone: string | null = null;
  let startWall: Date;
  const dateStart = /^DTSTART;VALUE=DATE:(\d{8})$/.exec(lines[0]!);
  const timedStart = /^DTSTART;TZID=([^:;]+):(\d{8})T(\d{2})(\d{2})00$/.exec(
    lines[0]!,
  );
  if (dateStart) {
    startWall = floating(spread(dateStart[1]!));
  } else if (timedStart) {
    zone = timedStart[1]!;
    if (!isTimeZone(zone)) return refuse("BAD_TIME_ZONE");
    startWall = floating(
      spread(timedStart[2]!),
      `${timedStart[3]}:${timedStart[4]}`,
    );
  } else {
    return refuse("SYNTAX");
  }
  if (Number.isNaN(startWall.getTime())) return refuse("SYNTAX");
  if (!lines[1]!.startsWith("RRULE:")) return refuse("SYNTAX");

  const parts = new Map<string, string>();
  for (const part of lines[1]!.slice("RRULE:".length).split(";")) {
    const [key, value, ...extra] = part.split("=");
    if (!key || !value || extra.length > 0 || parts.has(key)) {
      return refuse("SYNTAX");
    }
    if (!ALLOWED_PARTS.has(key)) return refuse("UNSUPPORTED_PART");
    parts.set(key, value);
  }

  const frequency = parts.get("FREQ");
  if (!frequency) return refuse("SYNTAX");
  if (!Object.hasOwn(FREQUENCIES, frequency)) return refuse("BAD_FREQUENCY");
  const freq = FREQUENCIES[frequency as RecurrenceFrequency];

  const interval = parts.has("INTERVAL") ? Number(parts.get("INTERVAL")) : 1;
  if (
    !/^\d+$/.test(parts.get("INTERVAL") ?? "1") ||
    interval < 1 ||
    interval > RECURRENCE_INTERVAL_MAX
  ) {
    return refuse("BAD_INTERVAL");
  }

  if (parts.has("UNTIL") && parts.has("COUNT")) {
    return refuse("UNTIL_AND_COUNT");
  }
  let count: number | undefined;
  if (parts.has("COUNT")) {
    count = Number(parts.get("COUNT"));
    if (
      !/^\d+$/.test(parts.get("COUNT")!) ||
      count < 1 ||
      count > RECURRENCE_COUNT_MAX
    ) {
      return refuse("BAD_COUNT");
    }
  }

  let until: Date | undefined;
  if (parts.has("UNTIL")) {
    const value = parts.get("UNTIL")!;
    const dayOnly = /^(\d{8})$/.exec(value);
    const instant = /^(\d{8})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
    if (dayOnly) {
      // A day ends the series after that day, whatever time the rule has.
      until = floating(spread(dayOnly[1]!), "23:59");
    } else if (instant) {
      const at = new Date(
        `${spread(instant[1]!)}T${instant[2]}:${instant[3]}:${instant[4]}Z`,
      );
      until = zone === null ? at : floatingOf({ at, hasTime: true }, zone);
    } else {
      return refuse("BAD_UNTIL");
    }
    if (Number.isNaN(until.getTime())) return refuse("BAD_UNTIL");
  }

  let byweekday: Weekday[] | undefined;
  if (parts.has("BYDAY")) {
    const days = parts.get("BYDAY")!.split(",").map(weekdayOf);
    if (days.some((day) => day === null)) return refuse("BAD_BYDAY");
    byweekday = days as Weekday[];
    if (
      byweekday.some((day) => day.n !== undefined) &&
      freq !== RRule.MONTHLY
    ) {
      return refuse("ORDINAL_NOT_MONTHLY");
    }
  }

  let bymonthday: number[] | undefined;
  if (parts.has("BYMONTHDAY")) {
    bymonthday = integers(parts.get("BYMONTHDAY")!, -31, 31) ?? undefined;
    if (!bymonthday) return refuse("BAD_BYMONTHDAY");
  }
  let bymonth: number[] | undefined;
  if (parts.has("BYMONTH")) {
    bymonth = integers(parts.get("BYMONTH")!, 1, 12) ?? undefined;
    if (!bymonth || bymonth.some((month) => month < 0)) {
      return refuse("BAD_BYMONTH");
    }
  }

  // DTSTART is the due date: a day rule on a day, a timed rule on a moment.
  if (due) {
    const matches =
      due.hasTime === (zone !== null) &&
      floatingOf(due, zone).getTime() === startWall.getTime();
    if (!matches) return refuse("DTSTART_MISMATCH");
  }
  const start = due ?? fromFloating(startWall, zone);

  const rule = new RRule({
    freq,
    ...(interval > 1 && { interval }),
    dtstart: startWall,
    ...(byweekday && { byweekday }),
    ...(bymonthday && { bymonthday }),
    ...(bymonth && { bymonth }),
    ...(count !== undefined && { count }),
    ...(until && { until }),
  });
  return { ok: true, recurrence: { rule, start, zone } };
}

/** The RFC 5545 text of a rule, as stored in `task.recurrence`. */
export function recurrenceText(recurrence: Recurrence) {
  const { dtstart: _start, ...options } = recurrence.rule.origOptions;
  const rrule = RRule.optionsToString(options).replace("BYDAY=+", "BYDAY=");
  return `${dtstartLine(recurrence)}\n${rrule}`;
}

/** What a rule is built from: the presets and the custom form both fill this in. */
export type RecurrenceOptions = {
  freq: RecurrenceFrequency;
  interval?: number;
  /** Weekdays, or the `nth` one of the month (1 to 5, or -1 for the last). */
  byDay?: { day: WeekdayCode; nth?: number }[];
  byMonthDay?: number[];
  byMonth?: number[];
  /** Ends after this many occurrences. */
  count?: number;
  /** Ends after this day, `YYYY-MM-DD`. */
  until?: string;
};

/**
 * A rule from options, starting on `due`. A timed rule is written in `zone`
 * (the setter's), a rule on a day in none.
 */
export function buildRecurrence(
  options: RecurrenceOptions,
  due: TaskDate,
  zone: string,
): Recurrence {
  const ruleZone = due.hasTime ? zone : null;
  const rule = new RRule({
    freq: FREQUENCIES[options.freq],
    ...(options.interval !== undefined &&
      options.interval > 1 && { interval: options.interval }),
    dtstart: floatingOf(due, ruleZone),
    ...(options.byDay && {
      byweekday: options.byDay.map(({ day, nth }) => {
        const weekday = WEEKDAYS[WEEKDAY_CODES.indexOf(day)]!;
        return nth === undefined ? weekday : weekday.nth(nth);
      }),
    }),
    ...(options.byMonthDay && { bymonthday: options.byMonthDay }),
    ...(options.byMonth && { bymonth: options.byMonth }),
    ...(options.count !== undefined && { count: options.count }),
    ...(options.until && { until: floating(options.until, "23:59") }),
  });
  return { rule, start: due, zone: ruleZone };
}

/**
 * The first occurrence strictly after `after`, as a day or a moment. One
 * before `today` (a late finish) is skipped for the first on or after
 * `today`, so a backlog of copies never piles up. Null when the series has
 * ended.
 */
export function nextOccurrence(
  { rule, zone }: Recurrence,
  after: TaskDate,
  today: string,
): TaskDate | null {
  const next = rule.after(floatingOf(after, zone), false);
  if (next === null) return null;
  if (dayOf(next) >= today) return fromFloating(next, zone);
  const current = rule.after(floating(today), true);
  return current === null ? null : fromFloating(current, zone);
}

/**
 * The same rule moved to a new due date: `DTSTART` follows it, and `COUNT`
 * drops by the occurrences it passed over, so the series still ends where it
 * did. A rule on days that gets a moment is written in `zone`; a timed rule
 * keeps its own zone.
 */
export function rebaseRecurrence(
  { rule, zone }: Recurrence,
  due: TaskDate,
  fallbackZone: string,
): Recurrence {
  const ruleZone = due.hasTime ? (zone ?? fallbackZone) : null;
  const dtstart = floatingOf(due, ruleZone);
  const { count, ...options } = rule.origOptions;
  let remaining = count;
  if (count != null) {
    let passed = 0;
    rule.all((at) => {
      if (at >= dtstart) return false;
      passed++;
      return true;
    });
    remaining = Math.max(1, count - passed);
  }
  return {
    rule: new RRule({
      ...options,
      dtstart,
      ...(remaining != null && { count: remaining }),
    }),
    start: due,
    zone: ruleZone,
  };
}

/** The rule in words ("every week on Monday"). English until a second locale exists. */
export function describeRecurrence({ rule }: Recurrence) {
  return rule.toText();
}

/** The words for a stored rule on its own, as history shows it; null if it is not one Morrow reads. */
export function describeRecurrenceText(text: string) {
  const parsed = parseRecurrence(text, null);
  return parsed.ok ? describeRecurrence(parsed.recurrence) : null;
}
