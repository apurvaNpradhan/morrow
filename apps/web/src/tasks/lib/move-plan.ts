import {
  carryFieldValues,
  type DroppedFieldValue,
  matchColumn,
  ticketId,
  type ProjectColumnRow,
  type ProjectFieldRow,
  type TaskRow,
} from "@morrow/sync-schemas";

type Side = {
  key: string;
  columns: readonly ProjectColumnRow[];
  fields: readonly ProjectFieldRow[];
};

export type MovePlan = {
  /** Everything that moves: the selected Tasks and, with Subtasks, their trees. */
  tasks: TaskRow[];
  /** The Column each moving Task lands in. */
  columnOf: ReadonlyMap<string, ProjectColumnRow>;
  /** Values the destination cannot hold, by Task. */
  dropped: Array<DroppedFieldValue & { ticketId: string }>;
  /** Whether any moving Task has Subtasks of its own to take along or leave. */
  hasSubtasks: boolean;
  /** Every Task lands in the Column with its own Column's name and category. */
  exact: boolean;
};

/**
 * What a move would do, from the rows the browser holds, so the picker can say
 * it before asking the server: how many Tasks move, where each lands and which
 * Field values are lost. The server's result is the source of truth; this only
 * has to agree with it. `projectTasks` is every Task of the source Project.
 */
export function planMove(input: {
  selected: readonly TaskRow[];
  projectTasks: readonly TaskRow[];
  withSubtasks: boolean;
  from: Side;
  to: Side;
  /** A Column of the destination for the selected Tasks; otherwise each Task keeps its state. */
  columnId?: string;
}): MovePlan {
  const { selected, projectTasks, from, to } = input;
  const children = new Map<string, TaskRow[]>();
  for (const task of projectTasks) {
    if (!task.parentId) continue;
    children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  }
  const moving = new Map(selected.map((task) => [task.id, task]));
  if (input.withSubtasks) {
    const pending = [...selected];
    while (pending.length > 0) {
      for (const child of children.get(pending.pop()!.id) ?? []) {
        if (moving.has(child.id)) continue;
        moving.set(child.id, child);
        pending.push(child);
      }
    }
  }
  const selectedIds = new Set(selected.map((task) => task.id));
  const chosen = to.columns.find((column) => column.id === input.columnId);
  const sourceColumn = new Map(
    from.columns.map((column) => [column.id, column]),
  );

  const columnOf = new Map<string, ProjectColumnRow>();
  let exact = true;
  const dropped: MovePlan["dropped"] = [];
  for (const task of moving.values()) {
    const own = sourceColumn.get(task.columnId);
    const match = own
      ? matchColumn(
          [...to.columns],
          { column: own.name, category: own.category },
          [],
        )
      : undefined;
    columnOf.set(
      task.id,
      (selectedIds.has(task.id) ? chosen : undefined) ??
        match?.column ??
        to.columns[0]!,
    );
    if (!match?.exact || match.column.category !== own?.category) exact = false;
    for (const lost of carryFieldValues(
      from.fields,
      to.fields,
      task.fieldValues,
    ).dropped) {
      dropped.push({ ...lost, ticketId: ticketId(from.key, task.number) });
    }
  }
  return {
    tasks: [...moving.values()],
    columnOf,
    dropped,
    hasSubtasks: [...moving.values()].some((task) => children.has(task.id)),
    exact,
  };
}

/** A single move that needs no question: one Task, its own state kept, nothing lost, nothing attached. */
export function needsNoConfirmation(plan: MovePlan, selectedCount: number) {
  return (
    selectedCount === 1 &&
    plan.tasks.length === 1 &&
    plan.exact &&
    plan.dropped.length === 0 &&
    !plan.hasSubtasks
  );
}
