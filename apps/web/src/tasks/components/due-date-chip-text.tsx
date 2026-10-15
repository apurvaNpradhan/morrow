import { useTranslation } from "react-i18next";
import { formatDate } from "@/design-system/format";
import { dueLabel } from "../lib/due-date";
import { parseDay } from "../lib/calendar-day";

/** A due date as words: "3d overdue", "Today", "In 4 days", or the date. */
export function DueDateText({
  dueDate,
  today,
}: {
  dueDate: string;
  today: string;
}) {
  const { t } = useTranslation("tasks");
  const label = dueLabel(dueDate, today);
  switch (label.kind) {
    case "overdueDays":
      return t("due.overdueDays", { count: label.count });
    case "overdueWeeks":
      return t("due.overdueWeeks", { count: label.count });
    case "today":
      return t("due.today");
    case "tomorrow":
      return t("due.tomorrow");
    case "inDays":
      return t("due.inDays", { count: label.count });
    case "date":
      return formatDate(parseDay(label.day), {
        month: "short",
        day: "numeric",
        ...(label.day.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
      });
  }
}
