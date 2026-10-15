import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import {
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "@/design-system/ui/menu";
import {
  isNegated,
  setFilterNegated,
  toggleFilterValue,
} from "../lib/filter-edit";
import type { TaskFilter } from "../lib/filters";
import { useFilterOptions } from "./use-filter-options";

/**
 * Edits one subject's filter: include or exclude, then which values. Used by
 * the filter menu's submenus and by the chip of an active filter.
 */
export function FilterEditorItems({
  subject,
  filters,
  onChange,
}: {
  subject: FilterSubject;
  filters: readonly TaskFilter[];
  onChange: (filters: TaskFilter[]) => void;
}) {
  const { t } = useTranslation("tasks");
  const { optionsFor } = useFilterOptions();
  const current = filters.find((filter) => filter.subject === subject);
  const negated = current ? isNegated(current.operator) : false;

  return (
    <>
      <MenuRadioGroup
        value={negated ? "not" : "is"}
        onValueChange={(next) => {
          // Choosing "is not" before any value is picked only sets the mode
          // the first value will start with.
          if (current)
            onChange(setFilterNegated(filters, subject, next === "not"));
        }}
      >
        <MenuRadioItem value="is">{t("filter.operator.is")}</MenuRadioItem>
        <MenuRadioItem value="not">{t("filter.operator.isNot")}</MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      {optionsFor(subject).map((option) => (
        <MenuCheckboxItem
          key={option.value}
          checked={current?.values.includes(option.value) ?? false}
          onCheckedChange={() =>
            onChange(toggleFilterValue(filters, subject, option.value))
          }
          closeOnClick={false}
        >
          {option.label}
        </MenuCheckboxItem>
      ))}
    </>
  );
}
