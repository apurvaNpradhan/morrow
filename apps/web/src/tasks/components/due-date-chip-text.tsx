import { useTranslation } from "react-i18next";
import { formatDate } from "@/design-system/format";
import { dueDay, dueLabel } from "../lib/due-date";
import { formatTaskTime } from "../lib/format-task-date";
import { parseDay } from "../lib/calendar-day";

/**
 * A due date as words: "3d overdue", "Today", "In 4 days", or the date. A
 * moment that is still ahead adds its time in `timeZone`.
 */
export function DueDateText({
  dueAt,
  dueHasTime,
  today,
  timeZone,
}: {
  dueAt: Date;
  dueHasTime: boolean;
  today: string;
  timeZone: string;
}) {
  const { t } = useTranslation("tasks");
  const label = dueLabel(dueDay({ dueAt, dueHasTime }, timeZone)!, today);
  const time = dueHasTime ? `, ${formatTaskTime(dueAt, timeZone)}` : "";
  switch (label.kind) {
    case "overdueDays":
      return t("due.overdueDays", { count: label.count });
    case "overdueWeeks":
      return t("due.overdueWeeks", { count: label.count });
    case "today":
      return `${t("due.today")}${time}`;
    case "tomorrow":
      return `${t("due.tomorrow")}${time}`;
    case "inDays":
      return `${t("due.inDays", { count: label.count })}${time}`;
    case "date":
      return `${formatDate(parseDay(label.day), {
        month: "short",
        day: "numeric",
        ...(label.day.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
      })}${time}`;
  }
}
