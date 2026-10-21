import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/design-system/ui/menu";

/** What the add-property menu offers: one property that has no value yet. */
export type AddableProperty = {
  /** The `data-sheet-field` of the chip it shows. */
  sheetField: string;
  label: string;
};

/**
 * The last row of the properties rail: lists the properties a task has no value
 * for. Choosing one shows its chip and opens its menu. Nothing renders when
 * every property has a value.
 */
export function AddPropertyMenu({
  properties,
  onAdd,
}: {
  properties: AddableProperty[];
  onAdd: (sheetField: string) => void;
}) {
  const { t } = useTranslation("tasks");
  if (properties.length === 0) return null;
  return (
    <Menu>
      <MenuTrigger
        aria-label={t("sheet.addProperty")}
        className="mt-1 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring @min-[720px]:h-8 @min-[720px]:w-full @min-[720px]:text-sm"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {t("sheet.addProperty")}
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-48">
        {properties.map((property) => (
          <MenuItem
            key={property.sheetField}
            onClick={() => onAdd(property.sheetField)}
          >
            {property.label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
