import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/design-system/format";
import { Input } from "@/design-system/ui/input";
import { MenuItem } from "@/design-system/ui/menu";
import { parseDay } from "../lib/calendar-day";
import { parseDateQuery } from "../lib/parse-date-query";

/** Keys the field keeps for itself, so the menu's typeahead and number keys leave it alone. */
const MENU_KEYS = new Set(["Escape", "ArrowDown", "ArrowUp", "Tab"]);

/**
 * A field at the top of a due-date menu: type `fri`, `7 days` or `nov 3` and
 * the date it means appears as the first choice; Enter applies it.
 */
export function TypedDueDate({
  today,
  onSelect,
}: {
  today: string;
  onSelect: (dueDate: string) => void;
}) {
  const { t } = useTranslation("tasks");
  const [query, setQuery] = useState("");
  const day = parseDateQuery(query, today);

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
            if (event.key === "Enter" && day) {
              event.preventDefault();
              event.stopPropagation();
              onSelect(day);
              return;
            }
            if (!MENU_KEYS.has(event.key)) event.stopPropagation();
          }}
        />
      </div>
      {day ? (
        <MenuItem onClick={() => onSelect(day)}>
          <CalendarDays aria-hidden="true" />
          {formatDate(parseDay(day), {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </MenuItem>
      ) : null}
    </>
  );
}
