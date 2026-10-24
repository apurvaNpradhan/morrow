import type { ProjectFieldRow } from "@morrow/sync-schemas";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuCheckboxItem, MenuItem } from "@/design-system/ui/menu";
import { LabelDot } from "@/labels";

/**
 * The Field's options as checkboxes. The menu stays open for the next pick, so
 * the checks are kept here too: the task behind them updates a moment later.
 */
export function MultiChoiceFieldItems({
  field,
  value,
  onSelect,
}: {
  field: ProjectFieldRow;
  /** The held option ids. */
  value: readonly string[] | undefined;
  /** The options now checked, or null when none is. */
  onSelect: (optionIds: string[] | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const [checked, setChecked] = useState<readonly string[]>(value ?? []);
  const held = JSON.stringify(value ?? []);
  useEffect(() => setChecked(JSON.parse(held) as string[]), [held]);

  function toggle(optionId: string) {
    // Options keep the Field's order, not the order they were ticked in.
    const next = field.options
      .map((option) => option.id)
      .filter((id) =>
        id === optionId ? !checked.includes(id) : checked.includes(id),
      );
    setChecked(next);
    onSelect(next.length > 0 ? next : null);
  }

  return (
    <>
      {field.options.map((option) => (
        <MenuCheckboxItem
          key={option.id}
          closeOnClick={false}
          checked={checked.includes(option.id)}
          onCheckedChange={() => toggle(option.id)}
        >
          <span className="flex items-center gap-2">
            <LabelDot color={option.color} />
            <span className="truncate">{option.name}</span>
          </span>
        </MenuCheckboxItem>
      ))}
      {checked.length > 0 ? (
        <MenuItem
          onClick={() => {
            setChecked([]);
            onSelect(null);
          }}
        >
          {t("fieldValues.clear")}
        </MenuItem>
      ) : null}
    </>
  );
}
