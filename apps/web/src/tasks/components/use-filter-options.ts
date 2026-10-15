import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import { DUE_VALUES, ME, UNASSIGNED } from "../lib/filters";
import { useTaskView } from "./task-view-context";

export type FilterOption = { value: string; label: string };

/** The values each filter subject offers, and how to word one of them. */
export function useFilterOptions() {
  const { t } = useTranslation("tasks");
  const { people, meId, columns } = useTaskView();

  function optionsFor(subject: FilterSubject): FilterOption[] {
    switch (subject) {
      case "assignee":
        return [
          { value: ME, label: t("filter.me") },
          { value: UNASSIGNED, label: t("assignee.unassigned") },
          ...people
            .filter((person) => person.id !== meId)
            .map((person) => ({ value: person.id, label: person.name })),
        ];
      case "priority":
        return TASK_PRIORITIES.map((priority) => ({
          value: priority,
          label: t(`priority.${priority}`),
        }));
      case "dueDate":
        return DUE_VALUES.map((value) => ({
          value,
          label: t(`filter.due.${value}`),
        }));
      case "column":
        return columns.map((column) => ({
          value: column.id,
          label: column.name,
        }));
    }
  }

  function labelFor(subject: FilterSubject, value: string) {
    return (
      optionsFor(subject).find((option) => option.value === value)?.label ??
      value
    );
  }

  return { optionsFor, labelFor };
}
