import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  fieldIdOf,
  FILTER_SUBJECTS,
  type FilterSubject,
} from "@/app/preferences/task-view-options";
import {
  CHECKED_FIELD_VALUE,
  DATE_FIELD_PRESETS,
  dateFieldValue,
  DUE_VALUES,
  START_VALUES,
  HAS_FIELD_VALUE,
  RELATION_VALUES,
  ME,
  NO_FIELD_VALUE,
  type NumberFieldOperator,
  numberFieldValue,
  parseNumberFieldValue,
  textFieldValue,
  UNASSIGNED,
} from "../lib/filters";
import { LabelDot } from "@/labels";
import { RelationIcon } from "./relation-icon";
import { ColumnMarker } from "./column-marker";
import { PersonAvatar } from "./person-avatar";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

type BuiltInSubject = (typeof FILTER_SUBJECTS)[number];

const NUMBER_SIGNS = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=" } as const;
const TYPED_NUMBER = /^\s*(>=|<=|≥|≤|>|<|=)?\s*(-?\d+(?:\.\d+)?)\s*$/;
const TYPED_OPERATORS = {
  ">": "gt",
  ">=": "gte",
  "≥": "gte",
  "<": "lt",
  "<=": "lte",
  "≤": "lte",
  "=": "eq",
} as const satisfies Record<string, NumberFieldOperator>;

export type FilterOption = {
  value: string;
  label: string;
  glyph?: ReactNode;
  /** How many tasks have this value, when the list is showing counts. */
  count?: number;
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
      const noValue = { value: NO_FIELD_VALUE, label: t("filter.noValue") };
      const field = fieldById.get(fieldId);
      switch (field?.type) {
        case "checkbox":
          return [
            { value: CHECKED_FIELD_VALUE, label: t("filter.checked") },
            { value: NO_FIELD_VALUE, label: t("filter.unchecked") },
          ];
        case "date":
          return [
            ...DATE_FIELD_PRESETS.map((preset) => ({
              value: dateFieldValue(preset),
              label: t(`filter.datePreset.${preset}`),
            })),
            noValue,
          ];
        case "number":
        case "text":
          return [
            noValue,
            { value: HAS_FIELD_VALUE, label: t("filter.hasValue") },
          ];
        default:
          return [
            noValue,
            ...(field?.options ?? []).map((option) => ({
              value: option.id,
              label: option.name,
              glyph: <LabelDot color={option.color} />,
            })),
          ];
      }
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
      case "startDate":
        return START_VALUES.map((value) => ({
          value,
          label: t(`filter.start.${value}`),
        }));
      case "dueDate":
        return DUE_VALUES.map((value) => ({
          value,
          label: t(`filter.due.${value}`),
        }));
      case "relation":
        return RELATION_VALUES.map((value) => ({
          value,
          label: t(`filter.relation.${value}`),
          glyph: <RelationIcon value={value} />,
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
      typedLabel(value)
    );
  }

  /** A value the user typed, in words: "> 5", "Contains “ana”". */
  function typedLabel(value: string) {
    const number = parseNumberFieldValue(value);
    if (number) return `${NUMBER_SIGNS[number.operator]} ${number.n}`;
    if (value.startsWith("text:")) {
      return t("filter.textContains", { text: value.slice(5) });
    }
    return value;
  }

  /**
   * For a text or number Field, the "use what I typed" row of the value list:
   * `> 5` or `3` for a number, any words for a text. Undefined for the rest.
   */
  function typedCreate(
    subject: FilterSubject,
    onPick: (value: string) => void,
  ) {
    const type = fieldById.get(fieldIdOf(subject) ?? "")?.type;
    if (type === "text") {
      return {
        label: (text: string) => typedLabel(textFieldValue(text)),
        accepts: () => true,
        onCreate: (text: string) => onPick(textFieldValue(text)),
      };
    }
    if (type !== "number") return undefined;
    const parse = (text: string) => {
      const match = TYPED_NUMBER.exec(text);
      return match
        ? numberFieldValue(
            TYPED_OPERATORS[(match[1] ?? "=") as keyof typeof TYPED_OPERATORS],
            Number(match[2]),
          )
        : null;
    };
    return {
      label: (text: string) => typedLabel(parse(text) ?? text),
      accepts: (text: string) => parse(text) !== null,
      onCreate: (text: string) => {
        const value = parse(text);
        if (value) onPick(value);
      },
    };
  }

  return { optionsFor, labelFor, subjectLabel, typedCreate };
}
