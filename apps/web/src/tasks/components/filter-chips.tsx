import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "@/design-system/ui/menu";
import { removeFilter } from "../lib/filter-edit";
import type { TaskFilter } from "../lib/filters";
import { FilterEditorItems } from "./filter-editor-items";
import { useFilterOptions } from "./use-filter-options";

/**
 * The active filters as chips, so a hidden filter is never forgotten: click a
 * chip to edit it, its cross to remove it, "Clear all" to start over.
 */
export function FilterChips({
  filters,
  onChange,
}: {
  filters: readonly TaskFilter[];
  onChange: (filters: TaskFilter[]) => void;
}) {
  const { t } = useTranslation("tasks");
  const { labelFor } = useFilterOptions();
  if (filters.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5"
      aria-label={t("filter.active")}
    >
      {filters.map((filter) => (
        <span
          key={filter.subject}
          className="inline-flex h-6 items-center overflow-hidden rounded-md border bg-muted/40 text-xs"
        >
          <Menu>
            <MenuTrigger
              className="flex h-full cursor-pointer items-center gap-1 px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("filter.edit", {
                subject: t(`filter.subject.${filter.subject}`),
              })}
            >
              <span>{t(`filter.subject.${filter.subject}`)}</span>
              <span className="text-muted-foreground">
                {t(`filter.operator.${filter.operator}`)}
              </span>
              <span className="font-medium">
                {filter.values
                  .map((value) => labelFor(filter.subject, value))
                  .join(", ")}
              </span>
            </MenuTrigger>
            <MenuPopup align="start" className="min-w-44">
              <FilterEditorItems
                subject={filter.subject}
                filters={filters}
                onChange={onChange}
              />
            </MenuPopup>
          </Menu>
          <button
            type="button"
            aria-label={t("filter.remove", {
              subject: t(`filter.subject.${filter.subject}`),
            })}
            className="flex h-full cursor-pointer items-center px-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange(removeFilter(filters, filter.subject))}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="xs" onClick={() => onChange([])}>
        {t("filter.clearAll")}
      </Button>
    </div>
  );
}
