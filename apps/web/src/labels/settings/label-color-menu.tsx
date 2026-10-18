import {
  COLUMN_COLOR_NAMES,
  COLUMN_COLORS,
  type ColumnColor,
} from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { LabelDot } from "../components/label-chip";

/** A dot in the label's colour that opens the palette. */
export function LabelColorMenu({
  labelName,
  value,
  disabled,
  onChange,
}: {
  labelName: string;
  value: ColumnColor;
  disabled: boolean;
  onChange: (color: ColumnColor) => void;
}) {
  const { t } = useTranslation("labels");

  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        aria-label={t("settings.colorLabel", { name: labelName })}
        className="grid size-7 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        <LabelDot color={value} className="size-3" />
      </MenuTrigger>
      <MenuPopup align="start">
        {COLUMN_COLORS.map((color) => (
          <MenuItem key={color} onClick={() => onChange(color)}>
            <LabelDot color={color} className="size-3" />
            {t(`colors.${COLUMN_COLOR_NAMES[color]}`)}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
