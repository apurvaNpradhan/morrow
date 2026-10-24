/**
 * A Task's start and due dates, shared by the API and the web app. Each is a
 * day or a moment. A day ("Friday") is stored as 00:00 UTC of that day and
 * read the same by everyone, never shifted into a time zone; a moment
 * ("Friday 15:00") is an instant shown in the reader's zone. Outside the
 * database a date is text: `YYYY-MM-DD` for a day, ISO 8601 for a moment.
 */

/** Whether `zone` is an IANA time zone name this runtime knows. */
export function isTimeZone(zone: string) {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A start or due date as the database holds it. */
export type TaskDate = { at: Date; hasTime: boolean };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A moment must say its offset: a time without one has no single instant.
const MOMENT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function isRealDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `YYYY-MM-DD` as a day, ISO 8601 with an offset as a moment, else null. */
export function parseTaskDate(text: string): TaskDate | null {
  const day = DAY.exec(text);
  if (day) {
    const [year, month, date] = day.slice(1).map(Number) as [
      number,
      number,
      number,
    ];
    if (!isRealDay(year, month, date)) return null;
    return { at: new Date(Date.UTC(year, month - 1, date)), hasTime: false };
  }
  const moment = MOMENT.exec(text);
  if (!moment) return null;
  const [year, month, date, hour, minute, second = "0"] = moment.slice(1, 7);
  if (!isRealDay(Number(year), Number(month), Number(date))) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59)
    return null;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? null : { at, hasTime: true };
}

/** The text form of a date: `YYYY-MM-DD` for a day, ISO UTC for a moment. */
export function formatTaskDate(at: Date | null, hasTime: boolean) {
  if (!at) return null;
  return hasTime ? at.toISOString() : at.toISOString().slice(0, 10);
}

/** The calendar day (`YYYY-MM-DD`) a date falls on for someone in `timeZone`. */
export function taskDateDay(at: Date, hasTime: boolean, timeZone: string) {
  if (!hasTime) return at.toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whether `text` is a day or a moment `parseTaskDate` reads. */
export function isTaskDateText(text: string) {
  return parseTaskDate(text) !== null;
}

function zoneParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** How far `timeZone` is ahead of UTC at `at`, in milliseconds. */
function zoneOffset(at: Date, timeZone: string) {
  const p = zoneParts(at, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock `time` (`HH:MM`) on `day` (`YYYY-MM-DD`) is in
 * `timeZone`. A time skipped by a daylight-saving jump lands an hour later.
 */
export function momentInZone(day: string, time: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  // Guess with the offset at the wall time read as UTC, then correct once
  // with the offset at the guess: right on both sides of a change.
  const guess = wall - zoneOffset(new Date(wall), timeZone);
  return new Date(wall - zoneOffset(new Date(guess), timeZone));
}

/** The wall-clock time (`HH:MM`) of `at` in `timeZone`. */
export function timeInZone(at: Date, timeZone: string) {
  const p = zoneParts(at, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
