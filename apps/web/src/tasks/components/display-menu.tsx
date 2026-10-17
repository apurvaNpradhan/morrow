import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SORT_FIELDS } from "@/app/preferences/task-view-options";
import { Button } from "@/design-system/ui/button";
import { TooltipLabel } from "@/design-system/tooltip-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import {
  defaultDirection,
  type SortDirection,
  type TaskSort,
} from "../lib/sort";
import type { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { type TaskDisplay, useTaskView } from "./task-view-context";

type Preferences = ReturnType<typeof useTaskViewPreferences>;

const DISPLAY_FIELDS = [
  "numbers",
  "assignees",
  "dueDates",
  "priority",
  "checklist",
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
  const { switchLayout } = useTaskView();
  const { layout, sort, display } = preferences;

  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
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
      <MenuPopup align="end" className="min-w-56">
        <MenuGroup>
          <MenuGroupLabel>{t("display.layout")}</MenuGroupLabel>
          <MenuRadioGroup
            value={layout}
            onValueChange={(next) => switchLayout(next as "board" | "list")}
          >
            <MenuRadioItem value="board">{t("display.board")}</MenuRadioItem>
            <MenuRadioItem value="list">{t("display.list")}</MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>{t("display.sort")}</MenuGroupLabel>
          <MenuRadioGroup
            value={sort.field}
            onValueChange={(next) => {
              const field = SORT_FIELDS.find((candidate) => candidate === next);
              if (field) {
                preferences.setSort({
                  field,
                  direction: defaultDirection(field),
                });
              }
            }}
          >
            {SORT_FIELDS.map((field) => (
              <MenuRadioItem key={field} value={field}>
                {t(`display.sortField.${field}`)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          {sort.field !== "manual" ? (
            <MenuRadioGroup
              value={sort.direction}
              onValueChange={(next) =>
                preferences.setSort({
                  ...sort,
                  direction: next as SortDirection,
                } satisfies TaskSort)
              }
            >
              <MenuRadioItem value="asc">
                {t("display.ascending")}
              </MenuRadioItem>
              <MenuRadioItem value="desc">
                {t("display.descending")}
              </MenuRadioItem>
            </MenuRadioGroup>
          ) : null}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>
            {t(
              layout === "board" ? "display.showOnCards" : "display.showOnRows",
            )}
          </MenuGroupLabel>
          {DISPLAY_FIELDS.map((field) => (
            <MenuCheckboxItem
              key={field}
              variant="switch"
              checked={display[field]}
              onCheckedChange={(checked) =>
                preferences.setDisplay(field, checked)
              }
              closeOnClick={false}
            >
              {t(`display.field.${field}`)}
            </MenuCheckboxItem>
          ))}
          {hasBackground ? (
            <MenuCheckboxItem
              variant="switch"
              checked={preferences.showBackground}
              onCheckedChange={preferences.setShowBackground}
              closeOnClick={false}
            >
              {t("display.background")}
            </MenuCheckboxItem>
          ) : null}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={preferences.reset}>{t("display.reset")}</MenuItem>
      </MenuPopup>
    </Menu>
  );
}
