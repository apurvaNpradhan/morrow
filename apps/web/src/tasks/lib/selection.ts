import { MAX_BULK_TASKS, type TaskRow } from "@morrow/sync-schemas";

/*
 * Pure rules of the task selection, over the ids in view order. The store
 * (`selection-store.ts`) holds the selection; these decide what a gesture makes
 * of it.
 */

/** The selection with `id` added, or removed when it is already in. */
export function toggle(selected: ReadonlySet<string>, id: string) {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/**
 * The selection plus every task from `anchor` to `target` in `order`. On the
 * board `order` is the target's Column; in the list it is the whole list. With
 * no anchor in `order`, only the target is added.
 */
export function extendRange(
  selected: ReadonlySet<string>,
  order: readonly string[],
  anchor: string | null,
  target: string,
) {
  const next = new Set(selected);
  const from = anchor === null ? -1 : order.indexOf(anchor);
  const to = order.indexOf(target);
  if (from === -1 || to === -1) {
    next.add(target);
    return next;
  }
  for (const id of order.slice(Math.min(from, to), Math.max(from, to) + 1)) {
    next.add(id);
  }
  return next;
}

/** Every task shown. */
export function selectAll(shown: readonly string[]) {
  return new Set(shown);
}

/** The selection without the tasks that are no longer shown. */
export function prune(selected: ReadonlySet<string>, shown: readonly string[]) {
  const visible = new Set(shown);
  const kept = [...selected].filter((id) => visible.has(id));
  return kept.length === selected.size ? selected : new Set(kept);
}

/** Whether the selection is too big for an action. */
export function overCap(count: number) {
  return count > MAX_BULK_TASKS;
}

/** Whether every selected task has the label, some do, or none. */
export function labelState(
  tasks: readonly Pick<TaskRow, "labelIds">[],
  labelId: string,
): "all" | "some" | "none" {
  const having = tasks.filter((task) => task.labelIds.includes(labelId));
  if (having.length === 0) return "none";
  return having.length === tasks.length ? "all" : "some";
}

/** "unarchive" only when every selected task is archived. */
export function archiveAction(tasks: readonly Pick<TaskRow, "archivedAt">[]) {
  return tasks.length > 0 && tasks.every((task) => task.archivedAt !== null)
    ? "unarchive"
    : "archive";
}
