import {
  comparePosition,
  TASK_PRIORITIES,
  type TaskPriority,
  type TaskRow,
} from "@morrow/sync-schemas";
import { fieldIdOf, type SortField } from "@/app/preferences/task-view-options";

export type SortDirection = "asc" | "desc";
export type TaskSort = { field: SortField; direction: SortDirection };

export const DEFAULT_SORT: TaskSort = { field: "manual", direction: "asc" };

/** Priority reads strongest first; every other field starts ascending. */
export function defaultDirection(field: SortField): SortDirection {
  return field === "priority" ? "desc" : "asc";
}

type Sortable = Pick<
  TaskRow,
  | "id"
  | "position"
  | "createdAt"
  | "priority"
  | "startAt"
  | "dueAt"
  | "title"
  | "number"
  | "fieldValues"
>;

/** The Fields a sort by `field:<id>` reads: each one's options, in any order. */
export type SortableField = {
  id: string;
  /** Left out for a choice Field. */
  type?: string;
  options: readonly { id: string; position: string }[];
};

/** The value a task is ordered by for a Field: an option's rank, a number or a string; null when it has none. */
function sortKey(
  value: TaskRow["fieldValues"][string] | undefined,
  /** The ranks of a choice Field's options; null for the other types. */
  optionRank: ReadonlyMap<string, number> | null,
): number | string | null {
  if (value === undefined) return null;
  if (typeof value === "string" && optionRank) {
    return optionRank.get(value) ?? null;
  }
  if (typeof value === "number" || typeof value === "string") return value;
  if (value === true) return 0;
  if (!optionRank) return null;
  // A multi choice sorts by its first option in the Field's order.
  const ranks = value.flatMap((id) => optionRank.get(id) ?? []);
  return ranks.length > 0 ? Math.min(...ranks) : null;
}

function compareKeys(a: number | string, b: number | string) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

// One collator and a rank lookup: a sort of 30k tasks calls the comparator
// hundreds of thousands of times, and `localeCompare` and `indexOf` cost far
// more per call.
const collator = new Intl.Collator();
const PRIORITY_RANK = Object.fromEntries(
  TASK_PRIORITIES.map((priority, rank) => [priority, rank]),
) as Record<TaskPriority, number>;

function direct(order: number, direction: SortDirection) {
  return direction === "asc" ? order : -order;
}

/**
 * Orders tasks for display. Manual is the board's own order (by position);
 * any other field ignores position. Tasks without a due date, or without a
 * value for the Field sorted by, always come last, whichever way the sort runs.
 * A choice Field orders by its options' order, not their names; a number
 * numerically, a date by day, a text by locale, and a checked box before an unchecked one.
 */
export function sortTasks<T extends Sortable>(
  tasks: readonly T[],
  { field, direction }: TaskSort,
  fields: readonly SortableField[] = [],
): T[] {
  const fieldId = fieldIdOf(field);
  const sortedField = fields.find((candidate) => candidate.id === fieldId);
  const isChoice =
    sortedField?.type === undefined || sortedField.type.endsWith("_choice");
  const optionRank = isChoice
    ? new Map(
        [...(sortedField?.options ?? [])]
          .sort((a, b) => (a.position < b.position ? -1 : 1))
          .map((option, rank) => [option.id, rank]),
      )
    : null;
  const byNumber = (a: T, b: T) =>
    a.number - b.number || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...tasks].sort((a, b) => {
    if (fieldId !== null) {
      const keyA = sortKey(a.fieldValues[fieldId], optionRank);
      const keyB = sortKey(b.fieldValues[fieldId], optionRank);
      if (keyA === keyB) return byNumber(a, b);
      if (keyA === null) return 1;
      if (keyB === null) return -1;
      return direct(compareKeys(keyA, keyB), direction) || byNumber(a, b);
    }
    switch (field) {
      case "manual":
        return comparePosition(a, b);
      case "created":
        return (
          direct(a.createdAt.getTime() - b.createdAt.getTime(), direction) ||
          byNumber(a, b)
        );
      case "priority":
        return (
          direct(
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
            direction,
          ) || byNumber(a, b)
        );
      case "startDate": {
        if (a.startAt === null && b.startAt === null) return byNumber(a, b);
        if (a.startAt === null) return 1;
        if (b.startAt === null) return -1;
        return (
          direct(a.startAt.getTime() - b.startAt.getTime(), direction) ||
          byNumber(a, b)
        );
      }
      case "dueDate": {
        if (a.dueAt === null && b.dueAt === null) return byNumber(a, b);
        if (a.dueAt === null) return 1;
        if (b.dueAt === null) return -1;
        return (
          direct(a.dueAt.getTime() - b.dueAt.getTime(), direction) ||
          byNumber(a, b)
        );
      }
      case "title":
        return (
          direct(collator.compare(a.title, b.title), direction) ||
          byNumber(a, b)
        );
      case "number":
        return direct(a.number - b.number, direction);
      default:
        return 0;
    }
  });
}
