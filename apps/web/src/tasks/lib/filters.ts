import type { TaskRow } from "@morrow/sync-schemas";
import { weekOf } from "./calendar-day";
import { dueDay, isOverdue, startDay } from "./due-date";
import { isNegated, operatorFor } from "./filter-edit";

import {
  fieldIdOf,
  type FilterOperator,
  type FilterSubject,
} from "@/app/preferences/task-view-options";

/** Values a subject offers besides ids and priorities. */
export const UNASSIGNED = "unassigned";
export const ME = "me";
/** The choice of a Field filter that matches Tasks with no value for it. */
export const NO_FIELD_VALUE = "noValue";
/** The choice that matches Tasks with any value; the opposite of `NO_FIELD_VALUE`. */
export const HAS_FIELD_VALUE = "hasValue";
/** A checkbox Field that is checked. Unchecked is `NO_FIELD_VALUE`. */
export const CHECKED_FIELD_VALUE = "checked";
/**
 * Filter values that carry their own condition, for Fields whose values are not
 * options: `date:<preset>` for a date, `num:<op>:<n>` for a number and
 * `text:<substring>` for a text. They are told apart by prefix, so the
 * matching needs no Field type.
 */
export const DATE_FIELD_PRESETS = [
  "overdue",
  "today",
  "thisWeek",
  "nextWeek",
] as const;
export const NUMBER_FIELD_OPERATORS = ["gt", "gte", "lt", "lte", "eq"] as const;
export type NumberFieldOperator = (typeof NUMBER_FIELD_OPERATORS)[number];

export const dateFieldValue = (preset: (typeof DATE_FIELD_PRESETS)[number]) =>
  `date:${preset}`;
export const numberFieldValue = (operator: NumberFieldOperator, n: number) =>
  `num:${operator}:${n}`;
export const textFieldValue = (text: string) => `text:${text}`;

/** The operator and number a `num:` filter value holds, or null when it is not one. */
export function parseNumberFieldValue(value: string) {
  const [prefix, operator, rest] = value.split(":");
  const n = Number(rest);
  if (
    prefix !== "num" ||
    !(NUMBER_FIELD_OPERATORS as readonly string[]).includes(operator ?? "") ||
    rest === undefined ||
    rest === "" ||
    !Number.isFinite(n)
  ) {
    return null;
  }
  return { operator: operator as NumberFieldOperator, n };
}
/** How a Task stands to others: parent, subtask, blocked, blocking, in any relation, duplicate. */
export const RELATION_VALUES = [
  "parentTask",
  "subtask",
  "blocked",
  "blocking",
  "hasRelations",
  "duplicate",
] as const;

/** The ids of the Tasks on the given end of a relation, from the Workspace's relations. */
export type RelationSets = {
  blocking: ReadonlySet<string>;
  /** On either end of any relation. */
  related: ReadonlySet<string>;
  /** On either end of a duplicate relation. */
  duplicate: ReadonlySet<string>;
};

export const NO_RELATIONS: RelationSets = {
  blocking: new Set(),
  related: new Set(),
  duplicate: new Set(),
};
export const DUE_VALUES = [
  "overdue",
  "today",
  "thisWeek",
  "nextWeek",
  "none",
] as const;
/** The start date's choices: before today, today, the weeks, already begun, none. */
export const START_VALUES = [
  "past",
  "today",
  "thisWeek",
  "nextWeek",
  "started",
  "none",
] as const;

/** One condition on a subject. Several values are alternatives. */
export type TaskFilter = {
  subject: FilterSubject;
  operator: FilterOperator;
  values: string[];
};

type FilterContext = {
  /** The signed-in user, for the "me" shortcut. */
  meId: string;
  /** Today in `timeZone`, `YYYY-MM-DD`. */
  today: string;
  /** The user's time zone: where a moment's day and "overdue" are read. */
  timeZone: string;
  weekStartsOn: number;
  relations: RelationSets;
};

function matchesValue(
  task: Pick<
    TaskRow,
    | "id"
    | "assigneeId"
    | "priority"
    | "startAt"
    | "startHasTime"
    | "dueAt"
    | "dueHasTime"
    | "columnId"
    | "completedAt"
    | "labelIds"
    | "fieldValues"
    | "parentId"
    | "subtaskTotal"
    | "openBlockerCount"
  >,
  subject: FilterSubject,
  value: string,
  context: FilterContext,
) {
  const fieldId = fieldIdOf(subject);
  if (fieldId !== null) {
    return matchesFieldValue(task.fieldValues[fieldId], value, context);
  }
  switch (subject) {
    case "assignee":
      if (value === UNASSIGNED) return task.assigneeId === null;
      return task.assigneeId === (value === ME ? context.meId : value);
    case "priority":
      return task.priority === value;
    case "column":
      return task.columnId === value;
    case "label":
      return task.labelIds.includes(value);
    case "relation":
      if (value === "parentTask") return task.subtaskTotal > 0;
      if (value === "subtask") return task.parentId !== null;
      if (value === "blocked") return task.openBlockerCount > 0;
      if (value === "blocking") return context.relations.blocking.has(task.id);
      if (value === "hasRelations")
        return context.relations.related.has(task.id);
      return value === "duplicate" && context.relations.duplicate.has(task.id);
    case "startDate":
      return matchesStart(task, value, context);
    case "dueDate":
      return matchesDue(task, value, context);
    default:
      return false;
  }
}

/** Whether `day` is today or in this or next week, by the preset's name. */
function matchesDayPreset(day: string, preset: string, context: FilterContext) {
  if (preset === "today") return day === context.today;
  const thisWeek = weekOf(context.today, context.weekStartsOn);
  if (preset === "thisWeek")
    return day >= thisWeek.start && day <= thisWeek.end;
  if (preset === "nextWeek") {
    // The day after this week ends is in next week.
    const next = weekOf(nextDay(thisWeek.end), context.weekStartsOn);
    return day >= next.start && day <= next.end;
  }
  return false;
}

function matchesDue(
  task: Pick<TaskRow, "dueAt" | "dueHasTime" | "completedAt">,
  value: string,
  context: FilterContext,
) {
  if (value === "none") return task.dueAt === null;
  const day = dueDay(task, context.timeZone);
  if (day === null) return false;
  if (value === "overdue") {
    return isOverdue(task, context.today, context.timeZone);
  }
  return matchesDayPreset(day, value, context);
}

function matchesStart(
  task: Pick<TaskRow, "startAt" | "startHasTime">,
  value: string,
  context: FilterContext,
) {
  if (value === "none") return task.startAt === null;
  const day = startDay(task, context.timeZone);
  if (day === null) return false;
  if (value === "past") return day < context.today;
  // A day has begun when it is today or earlier; a moment, once it has passed.
  if (value === "started") {
    return task.startHasTime
      ? task.startAt!.getTime() <= Date.now()
      : day <= context.today;
  }
  return matchesDayPreset(day, value, context);
}

function matchesFieldValue(
  held: TaskRow["fieldValues"][string] | undefined,
  value: string,
  context: FilterContext,
) {
  if (value === NO_FIELD_VALUE) return held === undefined;
  if (held === undefined) return false;
  if (value === HAS_FIELD_VALUE) return true;
  if (value === CHECKED_FIELD_VALUE) return held === true;
  if (value.startsWith("date:")) {
    return (
      typeof held === "string" && matchesDate(held, value.slice(5), context)
    );
  }
  if (value.startsWith("num:")) {
    const condition = parseNumberFieldValue(value);
    return (
      typeof held === "number" &&
      condition !== null &&
      compare(held, condition.operator, condition.n)
    );
  }
  if (value.startsWith("text:")) {
    return (
      typeof held === "string" &&
      held.toLowerCase().includes(value.slice(5).toLowerCase())
    );
  }
  return Array.isArray(held) ? held.includes(value) : held === value;
}

function compare(held: number, operator: NumberFieldOperator, n: number) {
  switch (operator) {
    case "gt":
      return held > n;
    case "gte":
      return held >= n;
    case "lt":
      return held < n;
    case "lte":
      return held <= n;
    case "eq":
      return held === n;
  }
}

/** A date Field against today and the weeks around it; unlike a due date, finishing a task does not clear "overdue". */
function matchesDate(day: string, preset: string, context: FilterContext) {
  if (preset === "overdue") return day < context.today;
  if (preset === "today") return day === context.today;
  const thisWeek = weekOf(context.today, context.weekStartsOn);
  if (preset === "thisWeek")
    return day >= thisWeek.start && day <= thisWeek.end;
  if (preset === "nextWeek") {
    const next = weekOf(nextDay(thisWeek.end), context.weekStartsOn);
    return day >= next.start && day <= next.end;
  }
  return false;
}

function nextDay(day: string) {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const next = new Date(year, month - 1, date + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

/** How many of the tasks a filter value would match. */
export function countMatching(
  tasks: readonly Parameters<typeof matchesValue>[0][],
  subject: FilterSubject,
  value: string,
  context: FilterContext,
) {
  let count = 0;
  for (const task of tasks) {
    if (matchesValue(task, subject, value, context)) count++;
  }
  return count;
}

/**
 * Whether a task passes every filter. Values of one filter are alternatives
 * (any of them); filters are combined (all of them). "Is not" and "is none of"
 * invert their own filter.
 */
export function matchesFilters(
  task: Parameters<typeof matchesValue>[0],
  filters: readonly TaskFilter[],
  context: FilterContext,
) {
  return filters.every((filter) => {
    const hit = filter.values.some((value) =>
      matchesValue(task, filter.subject, value, context),
    );
    return filter.operator === "isNot" || filter.operator === "isNoneOf"
      ? !hit
      : hit;
  });
}

/** Whether a filter value is one a Field of this type can hold. */
function fitsField(
  field: { type?: string; options: readonly { id: string }[] },
  value: string,
) {
  if (value === NO_FIELD_VALUE) return true;
  switch (field.type) {
    case "checkbox":
      return value === CHECKED_FIELD_VALUE;
    case "date":
      return (
        value.startsWith("date:") &&
        (DATE_FIELD_PRESETS as readonly string[]).includes(value.slice(5))
      );
    case "number":
      return value === HAS_FIELD_VALUE || parseNumberFieldValue(value) !== null;
    case "text":
      return value === HAS_FIELD_VALUE || value.startsWith("text:");
    default:
      return field.options.some((option) => option.id === value);
  }
}

/**
 * Drops what names a deleted Field or option: a filter on a Field that is gone,
 * and values that its type can no longer hold (an option that was deleted, a
 * date preset on a Field that is now something else). A filter left with no
 * value goes too. Returns the same array when nothing changed.
 */
export function pruneFieldFilters(
  filters: readonly TaskFilter[],
  fields: readonly {
    id: string;
    /** Left out for a choice Field. */
    type?: string;
    options: readonly { id: string }[];
  }[],
): readonly TaskFilter[] {
  let changed = false;
  const kept = filters.flatMap((filter) => {
    const fieldId = fieldIdOf(filter.subject);
    if (fieldId === null) return [filter];
    const field = fields.find((candidate) => candidate.id === fieldId);
    const values = field
      ? filter.values.filter((value) => fitsField(field, value))
      : [];
    if (values.length === filter.values.length) return [filter];
    changed = true;
    if (values.length === 0) return [];
    return [
      {
        ...filter,
        operator: operatorFor(isNegated(filter.operator), values.length),
        values,
      },
    ];
  });
  return changed ? kept : filters;
}
