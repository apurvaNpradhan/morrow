import type { ProjectFieldRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { MenuRadioGroup, MenuRadioItem } from "@/design-system/ui/menu";
import { LabelDot } from "@/labels";
import { optionHeld } from "../lib/field-value";
import { DigitHint, DigitKeys, digitProps } from "./digit-keys";

const NO_VALUE = "";

/** "No value", then the Field's options in order: the choices of a choice Field as menu items. */
export function FieldValueItems({
  field,
  fieldValues,
  onSelect,
}: {
  field: ProjectFieldRow;
  fieldValues: Readonly<Record<string, string>>;
  /** The chosen option's id, or null for "No value". */
  onSelect: (optionId: string | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const held = optionHeld(field, fieldValues);
  return (
    <MenuRadioGroup
      value={held?.id ?? NO_VALUE}
      onValueChange={(next) => onSelect(next === NO_VALUE ? null : next)}
    >
      <DigitKeys />
      <MenuRadioItem value={NO_VALUE} {...digitProps(1)}>
        <span className="flex w-full items-center gap-2">
          {t("fieldValues.noValue")}
          <DigitHint n={1} />
        </span>
      </MenuRadioItem>
      {field.options.map((option, index) => (
        <MenuRadioItem
          key={option.id}
          value={option.id}
          {...digitProps(index + 2)}
        >
          <span className="flex w-full items-center gap-2">
            <LabelDot color={option.color} />
            <span className="truncate">{option.name}</span>
            <DigitHint n={index + 2} />
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}
