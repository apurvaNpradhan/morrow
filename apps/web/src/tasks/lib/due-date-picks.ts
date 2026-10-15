import { addDaysTo, parseDay, weekOf } from "./calendar-day";

export type QuickDueDate = {
  key: "today" | "tomorrow" | "weekend" | "nextWeek";
  day: string;
};

/**
 * The one-click due dates: today, tomorrow, this weekend (Saturday, or today
 * on a Sunday) and the first day of next week.
 */
export function quickDueDates(
  today: string,
  weekStartsOn: number,
): QuickDueDate[] {
  const weekday = parseDay(today).getDay();
  const untilSaturday = weekday === 0 ? 0 : 6 - weekday;
  const { end } = weekOf(today, weekStartsOn);
  return [
    { key: "today", day: today },
    { key: "tomorrow", day: addDaysTo(today, 1) },
    { key: "weekend", day: addDaysTo(today, untilSaturday) },
    { key: "nextWeek", day: addDaysTo(end, 1) },
  ];
}
