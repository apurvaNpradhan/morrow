import {
  checkFieldValue,
  type FieldValue,
  type ProjectFieldRow,
} from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/design-system/ui/input";
import { MenuItem } from "@/design-system/ui/menu";
import { fieldValueText } from "../lib/field-value";

/** Keys the box keeps for itself, so the menu's typeahead and number keys leave it alone. */
const MENU_KEYS = new Set(["Escape", "ArrowDown", "ArrowUp", "Tab"]);

/** What was typed as the Field's value, if it is one: a trimmed text, or a finite number. */
function typedValue(field: ProjectFieldRow, text: string) {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const candidate = field.type === "number" ? Number(trimmed) : trimmed;
  const checked = checkFieldValue(field, candidate);
  return checked.ok ? checked.value : undefined;
}

/** A text or number Field: a box to type the value in, applied with Enter or the item below it. */
export function TypedFieldItems({
  field,
  value,
  onSelect,
}: {
  field: ProjectFieldRow;
  value: FieldValue | undefined;
  onSelect: (value: FieldValue | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [rejected, setRejected] = useState(false);
  const typed = typedValue(field, text);
  const isNumber = field.type === "number";
  const { min, max } = field.config;

  function apply() {
    if (typed === undefined) setRejected(true);
    else onSelect(typed);
  }

  return (
    <>
      <div className="px-1 pb-1">
        <Input
          size="sm"
          autoFocus
          unstyled
          value={text}
          inputMode={isNumber ? "decimal" : "text"}
          aria-label={field.name}
          aria-invalid={rejected && typed === undefined}
          placeholder={
            isNumber
              ? min !== undefined && max !== undefined
                ? t("fieldValues.numberBetween", { min, max })
                : t("fieldValues.typeNumber")
              : field.config.format === "url"
                ? t("fieldValues.typeUrl")
                : t("fieldValues.typeText")
          }
          className="w-full bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground aria-invalid:text-destructive-foreground"
          onChange={(event) => {
            setText(event.target.value);
            setRejected(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              apply();
              return;
            }
            if (!MENU_KEYS.has(event.key)) event.stopPropagation();
          }}
        />
      </div>
      {typed !== undefined && typed !== value ? (
        <MenuItem onClick={apply}>
          {t("fieldValues.set", { value: fieldValueText(field, typed) })}
        </MenuItem>
      ) : null}
      {value !== undefined ? (
        <MenuItem onClick={() => onSelect(null)}>
          {t("fieldValues.clear")}
        </MenuItem>
      ) : null}
    </>
  );
}
