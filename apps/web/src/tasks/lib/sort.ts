import {
  comparePosition,
  TASK_PRIORITIES,
  type TaskPriority,
  type TaskRow,
} from "@morrow/sync-schemas";
import type { SortField } from "@/app/preferences/task-view-options";

export type SortDirection = "asc" | "desc";
export type TaskSort = { field: SortField; direction: SortDirection };

export const DEFAULT_SORT: TaskSort = { field: "manual", direction: "asc" };

/** Priority reads strongest first; every other field starts ascending. */
export function defaultDirection(field: SortField): SortDirection {
  return field === "priority" ? "desc" : "asc";
}

type Sortable = Pick<
  TaskRow,
  "id" | "position" | "createdAt" | "priority" | "dueDate" | "title" | "number"
>;

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
 * any other field ignores position. Tasks without a due date always come last,
 * whichever way the dates run.
 */
export function sortTasks<T extends Sortable>(
  tasks: readonly T[],
  { field, direction }: TaskSort,
): T[] {
  const byNumber = (a: T, b: T) =>
    a.number - b.number || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...tasks].sort((a, b) => {
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
      case "dueDate": {
        if (a.dueDate === b.dueDate) return byNumber(a, b);
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return direct(a.dueDate < b.dueDate ? -1 : 1, direction);
      }
      case "title":
        return (
          direct(collator.compare(a.title, b.title), direction) ||
          byNumber(a, b)
        );
      case "number":
        return direct(a.number - b.number, direction);
    }
  });
}
