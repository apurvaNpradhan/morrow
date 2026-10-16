import type { TaskRow } from "@morrow/sync-schemas";
import { weekOf } from "./calendar-day";

import type {
  FilterOperator,
  FilterSubject,
} from "@/app/preferences/task-view-options";

/** Values a subject offers besides ids and priorities. */
export const UNASSIGNED = "unassigned";
export const ME = "me";
export const DUE_VALUES = ["overdue", "thisWeek", "nextWeek", "none"] as const;

/** One condition on a subject. Several values are alternatives. */
export type TaskFilter = {
  subject: FilterSubject;
  operator: FilterOperator;
  values: string[];
};

type FilterContext = {
  /** The signed-in user, for the "me" shortcut. */
  meId: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  today: string;
  weekStartsOn: number;
};

function matchesValue(
  task: Pick<
    TaskRow,
    | "assigneeId"
    | "priority"
    | "dueDate"
    | "columnId"
    | "completedAt"
    | "labelIds"
  >,
  subject: FilterSubject,
  value: string,
  context: FilterContext,
) {
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
    case "dueDate": {
      if (value === "none") return task.dueDate === null;
      if (task.dueDate === null) return false;
      if (value === "overdue") {
        return task.completedAt === null && task.dueDate < context.today;
      }
      const thisWeek = weekOf(context.today, context.weekStartsOn);
      if (value === "thisWeek") {
        return task.dueDate >= thisWeek.start && task.dueDate <= thisWeek.end;
      }
      if (value === "nextWeek") {
        const next = weekOf(
          // The day after this week ends is in next week.
          nextDay(thisWeek.end),
          context.weekStartsOn,
        );
        return task.dueDate >= next.start && task.dueDate <= next.end;
      }
      return false;
    }
  }
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
