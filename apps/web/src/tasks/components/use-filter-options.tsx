import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import { DUE_VALUES, ME, UNASSIGNED } from "../lib/filters";
import { LabelDot } from "@/labels";
import { ColumnMarker } from "./column-marker";
import { PersonAvatar } from "./person-avatar";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

export type FilterOption = {
  value: string;
  label: string;
  glyph?: ReactNode;
};

/** The values each filter subject offers, and how to word one of them. */
export function useFilterOptions() {
  const { t } = useTranslation("tasks");
  const { people, meId, columns, statusFractions, labels } = useTaskView();

  function optionsFor(subject: FilterSubject): FilterOption[] {
    switch (subject) {
      case "assignee":
        return [
          { value: ME, label: t("filter.me") },
          { value: UNASSIGNED, label: t("assignee.unassigned") },
          ...people
            .filter((person) => person.id !== meId)
            .map((person) => ({
              value: person.id,
              label: person.name,
              glyph: <PersonAvatar person={person} className="size-4" />,
            })),
        ];
      case "priority":
        return TASK_PRIORITIES.map((priority) => ({
          value: priority,
          label: t(`priority.${priority}`),
          glyph: <TaskPriorityIcon priority={priority} />,
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
          glyph: (
            <ColumnMarker
              column={column}
              fraction={statusFractions.get(column.id)}
            />
          ),
        }));
      case "label":
        return labels.map((label) => ({
          value: label.id,
          label: label.name,
          glyph: <LabelDot color={label.color} />,
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
