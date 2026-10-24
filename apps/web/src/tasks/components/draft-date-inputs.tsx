import { isCalendarDate } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { Input } from "@/design-system/ui/input";
import { splitTaskDateText, taskDateText } from "../lib/format-task-date";

/**
 * A date input and a time input for a draft's due date (text form). Clearing
 * the date clears the due date; a date alone is a day.
 */
export function DraftDateInputs({
  value,
  timeZone,
  onChange,
}: {
  value: string | null;
  timeZone: string;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const { day, time } = splitTaskDateText(value, timeZone);
  return (
    <>
      <Input
        type="date"
        size="sm"
        className="h-7 w-40"
        aria-label={t("fields.dueDate")}
        value={day}
        onChange={(event) =>
          onChange(
            isCalendarDate(event.target.value)
              ? taskDateText(event.target.value, time || undefined, timeZone)
              : null,
          )
        }
      />
      <Input
        type="time"
        size="sm"
        className="h-7 w-28"
        aria-label={t("due.time")}
        disabled={day === ""}
        value={time}
        onChange={(event) =>
          onChange(taskDateText(day, event.target.value || undefined, timeZone))
        }
      />
    </>
  );
}
