import type {
  ColumnColor,
  ProjectIcon as ProjectIconName,
} from "@morrow/sync-schemas";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { filterProjectIcons } from "../lib/filter-project-icons";
import { emojiOfIcon } from "../lib/project-emojis";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";
import { projectColorStyle } from "../lib/column-style";
import { ProjectColorSwatches } from "./project-color-swatches";
import { ProjectEmojiGrid } from "./project-emoji-grid";

type ProjectIconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
  color: string | null;
  onColorChange: (color: ColumnColor | null) => void;
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
  color,
  onColorChange,
  disabled,
  fallbackLetter,
}: ProjectIconPickerProps) {
  const { t } = useTranslation("projects");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"icons" | "emoji">(
    emojiOfIcon(value) ? "emoji" : "icons",
  );
  const emoji = emojiOfIcon(value);
  const icons = useMemo(() => filterProjectIcons(query), [query]);
  const Selected =
    value && value in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[value as ProjectIconName]
      : null;

  function pick(icon: string | null) {
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
        className={cn(
          "grid size-8.5 shrink-0 place-items-center rounded-lg border bg-control text-sm font-semibold text-foreground outline-none transition-colors hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
        )}
        style={projectColorStyle(color)}
      >
        {emoji ? (
          <span aria-hidden="true" className="text-base leading-none">
            {emoji}
          </span>
        ) : Selected ? (
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
        <div role="tablist" className="flex gap-1">
          {(["icons", "emoji"] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-accent aria-selected:text-foreground"
            >
              {t(`icon.tab.${name}`)}
            </button>
          ))}
        </div>
        {tab === "emoji" ? (
          <ProjectEmojiGrid value={value} query={query} onPick={pick} />
        ) : icons.length === 0 ? (
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
        <ProjectColorSwatches value={color} onChange={onColorChange} />
      </PopoverPopup>
    </Popover>
  );
}
