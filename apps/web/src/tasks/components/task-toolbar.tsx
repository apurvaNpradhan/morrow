import type { TaskRow } from "@morrow/sync-schemas";
import { Search, X } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import type { TaskFilter } from "../lib/filters";
import type { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { DisplayMenu } from "./display-menu";
import { FilterAddPopover } from "./filter-add-popover";
import { ProjectProgress } from "./project-progress";
import { FilterBar } from "./filter-bar";
import { useFilterBar } from "./use-filter-bar";

type Preferences = ReturnType<typeof useTaskViewPreferences>;

/**
 * Under the project header: how many tasks are shown, search, filter and
 * display, then a row of chips for the filters that are on.
 */
export function TaskToolbar({
  shown,
  total,
  search,
  onSearchChange,
  searchRef,
  preferences,
  filters,
  onFiltersChange,
  filterOpen,
  onFilterOpenChange,
  displayOpen,
  onDisplayOpenChange,
  hasBackground,
  tasks,
}: {
  shown: number;
  total: number;
  search: string;
  onSearchChange: (search: string) => void;
  searchRef: Ref<HTMLInputElement>;
  preferences: Preferences;
  filters: readonly TaskFilter[];
  onFiltersChange: (filters: TaskFilter[]) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  displayOpen: boolean;
  onDisplayOpenChange: (open: boolean) => void;
  hasBackground: boolean;
  /** The loaded tasks, for the counts beside filter values. */
  tasks: readonly TaskRow[];
}) {
  const { t } = useTranslation("tasks");
  const bar = useFilterBar({
    filters,
    onChange: onFiltersChange,
  });
  return (
    <div className="border-b">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <p
          className="text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {shown === total
            ? t("toolbar.count", { count: total })
            : t("toolbar.countOf", { shown, total })}
        </p>
        <div className="me-auto">
          <ProjectProgress />
        </div>
        <div className="relative max-md:order-last max-md:w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            type="search"
            size="sm"
            className="h-7 w-full ps-7 pe-7 md:w-48"
            value={search}
            placeholder={t("toolbar.search")}
            aria-label={t("toolbar.search")}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search !== "") {
                event.preventDefault();
                event.stopPropagation();
                onSearchChange("");
              }
            }}
          />
          {search !== "" ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute end-0.5 top-1/2 -translate-y-1/2"
              aria-label={t("toolbar.clearSearch")}
              onClick={() => onSearchChange("")}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <FilterAddPopover
          open={filterOpen}
          onOpenChange={onFilterOpenChange}
          filters={filters}
          onToggleValue={bar.toggleValue}
          tasks={tasks}
          includeColumn={preferences.layout === "list"}
        />
        <DisplayMenu
          preferences={preferences}
          hasBackground={hasBackground}
          open={displayOpen}
          onOpenChange={onDisplayOpenChange}
        />
      </div>
      <FilterBar onChange={onFiltersChange} bar={bar} />
    </div>
  );
}
