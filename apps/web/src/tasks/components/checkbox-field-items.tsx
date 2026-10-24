import type { FieldValue } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { MenuRadioGroup, MenuRadioItem } from "@/design-system/ui/menu";
import { DigitHint, DigitKeys, digitProps } from "./digit-keys";

/** A checkbox Field's two states. Unchecked clears the value. */
export function CheckboxFieldItems({
  checked,
  onSelect,
}: {
  checked: boolean;
  onSelect: (value: FieldValue | null) => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <MenuRadioGroup
      value={checked ? "checked" : "unchecked"}
      onValueChange={(next) => onSelect(next === "checked" ? true : null)}
    >
      <DigitKeys />
      <MenuRadioItem value="checked" {...digitProps(1)}>
        <span className="flex w-full items-center gap-2">
          {t("fieldValues.checked")}
          <DigitHint n={1} />
        </span>
      </MenuRadioItem>
      <MenuRadioItem value="unchecked" {...digitProps(2)}>
        <span className="flex w-full items-center gap-2">
          {t("fieldValues.unchecked")}
          <DigitHint n={2} />
        </span>
      </MenuRadioItem>
    </MenuRadioGroup>
  );
}
