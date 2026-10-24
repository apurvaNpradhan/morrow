import { useTranslation } from "react-i18next";
import { MenuItem } from "@/design-system/ui/menu";
import { localeWeekStart } from "../lib/calendar-day";
import { quickDueDates } from "../lib/due-date-picks";
import { useTimeZone } from "@/app/hooks/use-time-zone";
import { useToday } from "../queries/use-today";
import { TypedDueDate } from "./typed-due-date";

/** A date Field: type a date, pick today, tomorrow, the weekend or next week, or clear it. */
export function DateFieldItems({
  value,
  onSelect,
}: {
  value: string | undefined;
  onSelect: (day: string | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const today = useToday();
  const timeZone = useTimeZone();
  return (
    <>
      <TypedDueDate
        today={today}
        timeZone={timeZone}
        allowTime={false}
        onSelect={onSelect}
      />
      {quickDueDates(today, localeWeekStart()).map(({ key, day }) => (
        <MenuItem key={key} onClick={() => onSelect(day)}>
          {t(`due.${key}`)}
        </MenuItem>
      ))}
      {value !== undefined ? (
        <MenuItem onClick={() => onSelect(null)}>
          {t("fieldValues.clear")}
        </MenuItem>
      ) : null}
    </>
  );
}
