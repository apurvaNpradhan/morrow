import { useTranslation } from "react-i18next";
import { MenuItem } from "@/design-system/ui/menu";
import { dayString, localeWeekStart } from "../lib/calendar-day";
import { quickDueDates } from "../lib/due-date-picks";
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
  const today = dayString(new Date());
  return (
    <>
      <TypedDueDate today={today} onSelect={onSelect} />
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
