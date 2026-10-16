import type { ProjectIcon as ProjectIconName } from "@morrow/sync-schemas";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { filterProjectIcons } from "../lib/filter-project-icons";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";

type ProjectIconPickerProps = {
  value: string | null;
  onChange: (icon: ProjectIconName | null) => void;
  disabled?: boolean;
  /** Shown on the trigger when there is no icon: the first letter of the key. */
  fallbackLetter: string;
};

const COLUMNS = 8;

const tile =
  "grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-foreground";

/** Moves focus between grid tiles with the arrow keys. */
function moveFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  const step = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -COLUMNS,
    ArrowDown: COLUMNS,
  }[event.key];
  if (!step) return;
  const tiles = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
  );
  const next =
    tiles[tiles.indexOf(document.activeElement as HTMLButtonElement) + step];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** A button showing the project's icon; it opens a searchable grid of every icon a project may use. */
export function ProjectIconPicker({
  value,
  onChange,
  disabled,
  fallbackLetter,
}: ProjectIconPickerProps) {
  const { t } = useTranslation("projects");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const icons = useMemo(() => filterProjectIcons(query), [query]);
  const Selected =
    value && value in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[value as ProjectIconName]
      : null;

  function pick(icon: ProjectIconName | null) {
    onChange(icon);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setQuery("");
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        aria-label={t("icon.label")}
        className="grid size-8.5 shrink-0 place-items-center rounded-lg border bg-background text-sm font-semibold text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        {Selected ? (
          <Selected aria-hidden="true" className="size-4" />
        ) : (
          (fallbackLetter || "?").toUpperCase()
        )}
      </PopoverTrigger>
      <PopoverPopup className="w-80 flex-col gap-2 p-2">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("icon.search")}
            aria-label={t("icon.search")}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={value === null}
            onClick={() => pick(null)}
          >
            {t("icon.clear")}
          </Button>
        </div>
        {icons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("icon.empty")}
          </p>
        ) : (
          <div
            role="toolbar"
            tabIndex={-1}
            aria-label={t("icon.label")}
            className="grid max-h-60 gap-0.5 overflow-y-auto"
            style={{
              gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
            }}
            onKeyDown={moveFocus}
          >
            {icons.map((name) => {
              const Icon = PROJECT_ICON_COMPONENTS[name];
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={value === name}
                  aria-label={name}
                  title={name}
                  onClick={() => pick(name)}
                  className={tile}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </button>
              );
            })}
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}
