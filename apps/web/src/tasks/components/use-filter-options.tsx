import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  fieldIdOf,
  FILTER_SUBJECTS,
  type FilterSubject,
} from "@/app/preferences/task-view-options";
import { DUE_VALUES, ME, NO_FIELD_VALUE, UNASSIGNED } from "../lib/filters";
import { LabelDot } from "@/labels";
import { ColumnMarker } from "./column-marker";
import { PersonAvatar } from "./person-avatar";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

type BuiltInSubject = (typeof FILTER_SUBJECTS)[number];

export type FilterOption = {
  value: string;
  label: string;
  glyph?: ReactNode;
};

/** The values each filter subject offers, and how to word one of them. */
export function useFilterOptions() {
  const { t } = useTranslation("tasks");
  const { people, meId, columns, statusFractions, labels, fieldById } =
    useTaskView();

  /** A subject as the filter UI names it: a built-in one by its label, a Field by its name. */
  function subjectLabel(subject: FilterSubject) {
    const fieldId = fieldIdOf(subject);
    if (fieldId !== null) return fieldById.get(fieldId)?.name ?? fieldId;
    return t(`filter.subject.${subject as BuiltInSubject}`);
  }

  function optionsFor(subject: FilterSubject): FilterOption[] {
    const fieldId = fieldIdOf(subject);
    if (fieldId !== null) {
      return [
        { value: NO_FIELD_VALUE, label: t("filter.noValue") },
        ...(fieldById.get(fieldId)?.options ?? []).map((option) => ({
          value: option.id,
          label: option.name,
          glyph: <LabelDot color={option.color} />,
        })),
      ];
    }
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
      default:
        return [];
    }
  }

  function labelFor(subject: FilterSubject, value: string) {
    return (
      optionsFor(subject).find((option) => option.value === value)?.label ??
      value
    );
  }

  return { optionsFor, labelFor, subjectLabel };
}
