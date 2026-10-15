import { addDays, format } from "date-fns";

/** `YYYY-MM-DD` of a local date; due dates are calendar days, never instants. */
export function dayString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** The local date at midnight for a `YYYY-MM-DD` string. */
export function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, date);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string) {
  const a = parseDay(from);
  const b = parseDay(to);
  // Round, not truncate: a daylight-saving change makes a day 23 or 25 hours.
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDaysTo(day: string, amount: number) {
  return dayString(addDays(parseDay(day), amount));
}

/** What browsers expose of a locale's calendar; the method form is the newer spelling. */
type LocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/** The locale's first day of the week, 0 (Sunday) to 6, as date-fns expects. */
export function localeWeekStart(locale = navigator.language) {
  const info: LocaleWithWeekInfo = new Intl.Locale(locale);
  const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay ?? 1;
  return firstDay % 7;
}

/** The first and last day (inclusive) of the week containing `day`. */
export function weekOf(day: string, weekStartsOn: number) {
  const date = parseDay(day);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(date, -offset);
  return { start: dayString(start), end: dayString(addDays(start, 6)) };
}
