import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseTaskDate, timeInZone } from "@morrow/sync-schemas";
import { formatDate } from "@/design-system/format";
import { Input } from "@/design-system/ui/input";
import { MenuItem } from "@/design-system/ui/menu";
import { parseDay } from "../lib/calendar-day";
import { formatTaskTime, taskDateText } from "../lib/format-task-date";
import { parseDateQuery } from "../lib/parse-date-query";

/** Keys the field keeps for itself, so the menu's typeahead and number keys leave it alone. */
const MENU_KEYS = new Set(["Escape", "ArrowDown", "ArrowUp", "Tab"]);

/**
 * A field at the top of a due-date menu: type `fri`, `7 days`, `nov 3` or
 * `fri 3pm` and the date it means appears as the first choice; Enter applies
 * it. A date Field has no time, so there a query with a time means nothing.
 * `onSelect` gets `YYYY-MM-DD`, or ISO 8601 for a moment.
 */
export function TypedDueDate({
  today,
  timeZone,
  allowTime = true,
  onSelect,
}: {
  today: string;
  timeZone: string;
  allowTime?: boolean;
  onSelect: (dueDate: string) => void;
}) {
  const { t } = useTranslation("tasks");
  const [query, setQuery] = useState("");
  const parsed = parseDateQuery(query, today, timeInZone(new Date(), timeZone));
  const typed =
    parsed && (allowTime || parsed.time === undefined)
      ? taskDateText(parsed.day, parsed.time, timeZone)
      : null;

  return (
    <>
      <div className="px-1 pb-1">
        <Input
          size="sm"
          value={query}
          placeholder={t("due.typeHint")}
          aria-label={t("due.typeLabel")}
          unstyled
          className="w-full bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && typed) {
              event.preventDefault();
              event.stopPropagation();
              onSelect(typed);
              return;
            }
            if (!MENU_KEYS.has(event.key)) event.stopPropagation();
          }}
        />
      </div>
      {typed && parsed ? (
        <MenuItem onClick={() => onSelect(typed)}>
          <CalendarDays aria-hidden="true" />
          {formatDate(parseDay(parsed.day), {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {parsed.time
            ? `, ${formatTaskTime(parseTaskDate(typed)!.at, timeZone)}`
            : null}
        </MenuItem>
      ) : null}
    </>
  );
}
