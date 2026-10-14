import {
  PROJECT_ICONS,
  type ProjectIcon as ProjectIconName,
} from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";

type ProjectIconPickerProps = {
  value: string | null;
  onChange: (icon: ProjectIconName | null) => void;
  disabled?: boolean;
  /** Shown on the "no icon" tile: the first letter of the key. */
  fallbackLetter: string;
};

const tile =
  "grid size-8 place-items-center rounded-md border text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 aria-checked:border-primary aria-checked:bg-accent aria-checked:text-foreground";

/** A grid of the icons a project may use; the first tile means "none". */
export function ProjectIconPicker({
  value,
  onChange,
  disabled,
  fallbackLetter,
}: ProjectIconPickerProps) {
  const { t } = useTranslation("projects");

  return (
    <div
      role="radiogroup"
      aria-label={t("icon.label")}
      className="flex max-w-sm flex-wrap gap-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={t("icon.none")}
        title={t("icon.none")}
        disabled={disabled}
        onClick={() => onChange(null)}
        className={cn(tile, "text-xs font-semibold")}
      >
        {fallbackLetter || "?"}
      </button>
      {PROJECT_ICONS.map((name) => {
        const Icon = PROJECT_ICON_COMPONENTS[name];
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={name}
            title={name}
            disabled={disabled}
            onClick={() => onChange(name)}
            className={tile}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
