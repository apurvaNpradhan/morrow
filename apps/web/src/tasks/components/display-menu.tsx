import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  LayoutGrid,
  List,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fieldSubject,
  isSortField,
  SORT_FIELDS,
} from "@/app/preferences/task-view-options";
import { Button } from "@/design-system/ui/button";
import { TooltipLabel } from "@/design-system/tooltip-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { cn } from "@/design-system/cn";
import { defaultDirection, type TaskSort } from "../lib/sort";
import type { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { type TaskDisplay, useTaskView } from "./task-view-context";

type Preferences = ReturnType<typeof useTaskViewPreferences>;

const DISPLAY_FIELDS = [
  "numbers",
  "assignees",
  "dueDates",
  "priority",
] as const satisfies readonly (keyof TaskDisplay)[];

/**
 * The Display button: layout, sort and what cards and rows show. Layout and
 * the toggles are remembered for the device; the sort for this Project.
 */
export function DisplayMenu({
  preferences,
  hasBackground,
  open,
  onOpenChange,
}: {
  preferences: Preferences;
  hasBackground: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("tasks");
  const { switchLayout, fields } = useTaskView();
  const { layout, sort, display } = preferences;

  const sortLabels = new Map<string, string>([
    ...SORT_FIELDS.map((f) => [f, t(`display.sortField.${f}`)] as const),
    ...fields.map((f) => [fieldSubject(f.id), f.name] as const),
  ]);
  const chips: {
    key: string;
    label: string;
    on: boolean;
    set: (on: boolean) => void;
  }[] = [
    ...DISPLAY_FIELDS.map((field) => ({
      key: field,
      label: t(`display.field.${field}`),
      on: display[field],
      set: (on: boolean) => preferences.setDisplay(field, on),
    })),
    ...fields.map((field) => ({
      key: field.id,
      label: field.name,
      on: preferences.showsField(field.id),
      set: (on: boolean) => preferences.setShowField(field.id, on),
    })),
    ...(hasBackground
      ? [
          {
            key: "background",
            label: t("display.background"),
            on: preferences.showBackground,
            set: preferences.setShowBackground,
          },
        ]
      : []),
  ];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant="outline" size="xs" />}
              aria-label={t("toolbar.display")}
            />
          }
        >
          <SlidersHorizontal aria-hidden="true" />
          {t("toolbar.display")}
        </TooltipTrigger>
        <TooltipContent>
          <TooltipLabel
            label={t("toolbar.display")}
            hotkeyId="displayOptions"
          />
        </TooltipContent>
      </Tooltip>
      <PopoverPopup align="end" className="w-80 p-0">
        <div className="flex flex-col divide-y">
          <div
            role="radiogroup"
            aria-label={t("display.layout")}
            className="grid grid-cols-2 gap-1 p-3"
          >
            {(
              [
                ["board", LayoutGrid],
                ["list", List],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={layout === value}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  layout === value &&
                    "border-border bg-accent text-foreground shadow-xs",
                )}
                onClick={() => switchLayout(value)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(`display.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3">
            <span className="me-auto text-sm">{t("display.sortBy")}</span>
            <Select
              value={sort.field}
              onValueChange={(next) => {
                if (next && isSortField(next)) {
                  preferences.setSort({
                    field: next,
                    direction: defaultDirection(next),
                  });
                }
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue>{sortLabels.get(sort.field)}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {[...sortLabels].map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            {sort.field !== "manual" ? (
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t(
                  sort.direction === "asc"
                    ? "display.ascending"
                    : "display.descending",
                )}
                onClick={() =>
                  preferences.setSort({
                    ...sort,
                    direction: sort.direction === "asc" ? "desc" : "asc",
                  } satisfies TaskSort)
                }
              >
                {sort.direction === "asc" ? (
                  <ArrowUpNarrowWide aria-hidden="true" />
                ) : (
                  <ArrowDownWideNarrow aria-hidden="true" />
                )}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 p-3">
            <span className="text-xs text-muted-foreground">
              {t(
                layout === "board"
                  ? "display.showOnCards"
                  : "display.showOnRows",
              )}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={chip.on}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    chip.on
                      ? "border-transparent bg-accent text-foreground"
                      : "text-muted-foreground opacity-70 hover:bg-accent/50",
                  )}
                  onClick={() => chip.set(!chip.on)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end px-3 py-2">
            <Button variant="ghost" size="xs" onClick={preferences.reset}>
              {t("display.reset")}
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
