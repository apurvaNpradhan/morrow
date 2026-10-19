import { ArrowLeft, ListFilter } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fieldSubject,
  FILTER_SUBJECTS,
  type FilterSubject,
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
import type { TaskFilter } from "../lib/filters";
import { FilterOptionList } from "./filter-option-list";
import { useFilterOptions } from "./use-filter-options";
import { useTaskView } from "./task-view-context";

/**
 * The Filter button: pick a field, then its values, all in one popover that
 * stays under the button. The chip joins the row once the first value is
 * ticked, so nothing moves under the pointer while choosing.
 */
export function FilterAddPopover({
  open,
  onOpenChange,
  filters,
  onToggleValue,
  includeColumn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: readonly TaskFilter[];
  onToggleValue: (subject: FilterSubject, value: string) => void;
  /** The Column filter exists only where Columns are separate, in the list. */
  includeColumn: boolean;
}) {
  const { t } = useTranslation("tasks");
  const { optionsFor, subjectLabel } = useFilterOptions();
  const { fields } = useTaskView();
  const [subject, setSubject] = useState<FilterSubject | null>(null);
  const subjects: FilterSubject[] = [
    ...FILTER_SUBJECTS.filter(
      (candidate) => includeColumn || candidate !== "column",
    ),
    ...fields.map((field) => fieldSubject(field.id)),
  ];
  const selected = new Set(
    filters.find((filter) => filter.subject === subject)?.values,
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSubject(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant="outline" size="xs" />}
              aria-label={t("toolbar.filter")}
            />
          }
        >
          <ListFilter aria-hidden="true" />
          {t("toolbar.filter")}
        </TooltipTrigger>
        <TooltipContent>
          <TooltipLabel label={t("toolbar.filter")} hotkeyId="filterTasks" />
        </TooltipContent>
      </Tooltip>
      <PopoverPopup>
        <div className="flex flex-col">
          {subject ? (
            <>
              <button
                type="button"
                className="flex items-center gap-1.5 border-b px-2.5 py-1.5 text-start text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setSubject(null)}
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                {subjectLabel(subject)}
              </button>
              <FilterOptionList
                key={subject}
                options={optionsFor(subject)}
                selected={selected}
                label={subjectLabel(subject)}
                onPick={(value) => onToggleValue(subject, value)}
              />
            </>
          ) : (
            <FilterOptionList
              key="subjects"
              options={subjects.map((candidate) => ({
                value: candidate,
                label: subjectLabel(candidate),
              }))}
              label={t("filter.field")}
              onPick={(value) => setSubject(value as FilterSubject)}
            />
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
