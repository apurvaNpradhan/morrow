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
import { colorDotStyle } from "../lib/column-style";

type ColumnColorMenuProps = {
  columnName: string;
  value: ColumnColor;
  disabled: boolean;
  onChange: (color: ColumnColor) => void;
};

/** A dot in the column's colour that opens the palette. */
export function ColumnColorMenu({
  columnName,
  value,
  disabled,
  onChange,
}: ColumnColorMenuProps) {
  const { t } = useTranslation("projects");

  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        aria-label={t("workflow.colorLabel", { name: columnName })}
        className="grid size-7 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={colorDotStyle(value)}
        />
      </MenuTrigger>
      <MenuPopup align="start">
        {COLUMN_COLORS.map((color) => (
          <MenuItem key={color} onClick={() => onChange(color)}>
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={colorDotStyle(color)}
            />
            {t(`colors.${COLUMN_COLOR_NAMES[color]}`)}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
