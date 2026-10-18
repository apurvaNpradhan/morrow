import {
  COLUMN_COLOR_NAMES,
  COLUMN_COLORS,
  type ColumnColor,
} from "@morrow/sync-schemas";
import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { colorDotStyle } from "../lib/column-style";

type ProjectColorSwatchesProps = {
  value: string | null;
  onChange: (color: ColumnColor | null) => void;
};

const swatch =
  "grid size-6 place-items-center rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground/70 aria-pressed:ring-offset-2 aria-pressed:ring-offset-popover";

/** A row of colour dots, plus one that means "no colour". */
export function ProjectColorSwatches({
  value,
  onChange,
}: ProjectColorSwatchesProps) {
  const { t } = useTranslation("projects");

  return (
    <div
      role="group"
      aria-label={t("icon.color")}
      className="flex items-center justify-between border-t px-1 pt-2"
    >
      <button
        type="button"
        aria-pressed={value === null}
        aria-label={t("icon.noColor")}
        title={t("icon.noColor")}
        onClick={() => onChange(null)}
        className={cn(swatch, "text-muted-foreground")}
      >
        <Ban aria-hidden="true" className="size-4" />
      </button>
      {COLUMN_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-pressed={value === color}
          aria-label={t(`colors.${COLUMN_COLOR_NAMES[color]}`)}
          title={t(`colors.${COLUMN_COLOR_NAMES[color]}`)}
          onClick={() => onChange(color)}
          className={swatch}
        >
          <span
            aria-hidden="true"
            className="size-4 rounded-full"
            style={colorDotStyle(color)}
          />
        </button>
      ))}
    </div>
  );
}
