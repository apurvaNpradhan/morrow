import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "@morrow/sync-schemas";
import {
  fieldSubject,
  FILTER_SUBJECTS,
  type FilterSubject,
} from "@/app/preferences/task-view-options";
import { Button } from "@/design-system/ui/button";
import { TooltipLabel } from "@/design-system/tooltip-label";
import {
  Menu,
  MenuPopup,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/design-system/ui/menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import { countMatching, NO_RELATIONS, type TaskFilter } from "../lib/filters";
import { localeWeekStart } from "../lib/calendar-day";
import { FilterOptionList } from "./filter-option-list";
import { useFilterOptions } from "./use-filter-options";
import { useTaskView } from "./task-view-context";

/**
 * The Filter button: a menu of fields, each opening a submenu of its values on
 * hover. The chip joins the row once the first value is ticked, so nothing
 * moves under the pointer while choosing.
 */
export function FilterAddPopover({
  open,
  onOpenChange,
  filters,
  onToggleValue,
  includeColumn,
  tasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: readonly TaskFilter[];
  onToggleValue: (subject: FilterSubject, value: string) => void;
  /** The Column filter exists only where Columns are separate, in the list. */
  includeColumn: boolean;
  /** The loaded tasks, counted per value. */
  tasks: readonly TaskRow[];
}) {
  const { t } = useTranslation("tasks");
  const { optionsFor, subjectLabel, typedCreate } = useFilterOptions();
  const { fields, meId, today, timeZone } = useTaskView();
  const subjects: FilterSubject[] = [
    ...FILTER_SUBJECTS.filter(
      (candidate) => includeColumn || candidate !== "column",
    ),
    ...fields.map((field) => fieldSubject(field.id)),
  ];

  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
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
      <MenuPopup align="end" className="min-w-44">
        {subjects.map((subject) => (
          <MenuSub key={subject}>
            <MenuSubTrigger>{subjectLabel(subject)}</MenuSubTrigger>
            <MenuSubPopup className="p-0">
              <SubjectValues
                subject={subject}
                selected={
                  new Set(
                    filters.find((filter) => filter.subject === subject)
                      ?.values,
                  )
                }
                tasks={tasks}
                context={{
                  meId,
                  today,
                  timeZone,
                  weekStartsOn: localeWeekStart(),
                  relations: NO_RELATIONS,
                }}
                label={subjectLabel(subject)}
                optionsFor={optionsFor}
                typedCreate={typedCreate}
                onPick={(value) => onToggleValue(subject, value)}
              />
            </MenuSubPopup>
          </MenuSub>
        ))}
      </MenuPopup>
    </Menu>
  );
}

/** A subject's values with counts; mounted only while its submenu is open. */
function SubjectValues({
  subject,
  selected,
  tasks,
  context,
  label,
  optionsFor,
  typedCreate,
  onPick,
}: {
  subject: FilterSubject;
  selected: ReadonlySet<string>;
  tasks: readonly TaskRow[];
  context: Parameters<typeof countMatching>[3];
  label: string;
  optionsFor: ReturnType<typeof useFilterOptions>["optionsFor"];
  typedCreate: ReturnType<typeof useFilterOptions>["typedCreate"];
  onPick: (value: string) => void;
}) {
  const options = optionsFor(subject).map((option) => ({
    ...option,
    // Relations are not counted: they read as plain choices.
    count:
      subject === "relation"
        ? undefined
        : countMatching(tasks, subject, option.value, context),
  }));
  return (
    // Typing in the search box must not trigger the menu's own typeahead.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={(event) => event.stopPropagation()}>
      <FilterOptionList
        options={options}
        selected={selected}
        label={label}
        onPick={onPick}
        create={typedCreate(subject, onPick)}
      />
    </div>
  );
}
