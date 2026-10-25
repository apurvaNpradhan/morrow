import type { TaskEvent, TaskEventFieldValueRef } from "@morrow/sync-schemas";

/** How long the same person's repeated edit still folds into their last one. */
export const TASK_EVENT_FOLD_WINDOW_MS = 10 * 60 * 1000;

/** The latest event of a task, as far as folding is concerned. */
export type LatestTaskEvent = {
  actorId: string | null;
  event: TaskEvent;
  /** When it was last written, folds included. */
  updatedAt: Date;
};

export type FoldDecision =
  | { kind: "insert" }
  | { kind: "merge"; data: TaskEvent["data"] }
  | { kind: "delete" };

type Moved = Extract<
  TaskEvent,
  {
    type:
      | "title"
      | "priority"
      | "due_date"
      | "start_date"
      | "recurrence"
      | "column"
      | "assignee";
  }
>;

/** What a field changed from and to, by identity: a Column or person by id, the rest by value. */
type Ends = { from: string | null; to: string | null };

function ends(event: Moved): Ends {
  switch (event.type) {
    case "column":
      return { from: event.data.from.id, to: event.data.to.id };
    case "assignee":
      return {
        from: event.data.from?.id ?? null,
        to: event.data.to?.id ?? null,
      };
    default:
      return { from: event.data.from, to: event.data.to };
  }
}

/** A Field's held value by identity: options by id, plain values by value. */
function valueKey(ref: TaskEventFieldValueRef) {
  if (ref === null) return "";
  if ("id" in ref) return `o:${ref.id}`;
  if ("options" in ref)
    return `m:${ref.options
      .map((o) => o.id)
      .sort()
      .join(",")}`;
  return `v:${JSON.stringify(ref.value)}`;
}

const isMoved = (event: TaskEvent): event is Moved =>
  event.type === "title" ||
  event.type === "priority" ||
  event.type === "due_date" ||
  event.type === "start_date" ||
  event.type === "recurrence" ||
  event.type === "column" ||
  event.type === "assignee";

/**
 * What to do with a new change given the task's latest event. The same person
 * changing the same field again within the window folds into their last event,
 * keeping its original "from"; folding it back to where it began deletes the
 * event, so the history shows only real changes. Label events fold their added
 * and removed sets, a label added then removed cancelling out; Field events
 * fold per Field, by option id or value; description edits fold into one. Anything else (another person, another field, an older
 * event, a beginning or an archive) is a new event.
 */
export function foldTaskEvent(
  latest: LatestTaskEvent | null,
  next: { actorId: string | null; event: TaskEvent },
  now: Date,
): FoldDecision {
  if (
    !latest ||
    latest.actorId === null ||
    latest.actorId !== next.actorId ||
    latest.event.type !== next.event.type ||
    now.getTime() - latest.updatedAt.getTime() > TASK_EVENT_FOLD_WINDOW_MS
  ) {
    return { kind: "insert" };
  }
  const before = latest.event;
  const after = next.event;

  if (before.type === "description") return { kind: "merge", data: {} };

  if (before.type === "labels" && after.type === "labels") {
    const added = new Map(before.data.added.map((label) => [label.id, label]));
    const removed = new Map(
      before.data.removed.map((label) => [label.id, label]),
    );
    for (const label of after.data.added) {
      if (!removed.delete(label.id)) added.set(label.id, label);
    }
    for (const label of after.data.removed) {
      if (!added.delete(label.id)) removed.set(label.id, label);
    }
    if (added.size === 0 && removed.size === 0) return { kind: "delete" };
    return {
      kind: "merge",
      data: { added: [...added.values()], removed: [...removed.values()] },
    };
  }

  if (before.type === "field_changed" && after.type === "field_changed") {
    // Another Field's change is its own entry.
    if (before.data.field.id !== after.data.field.id) {
      return { kind: "insert" };
    }
    if (valueKey(before.data.from) === valueKey(after.data.to)) {
      return { kind: "delete" };
    }
    return {
      kind: "merge",
      data: {
        field: after.data.field,
        from: before.data.from,
        to: after.data.to,
      },
    };
  }
  if (isMoved(before) && isMoved(after)) {
    if (ends(before).from === ends(after).to) return { kind: "delete" };
    return {
      kind: "merge",
      // Both are the same type, so the payload keeps its shape.
      data: { from: before.data.from, to: after.data.to } as Moved["data"],
    };
  }

  // Beginnings and archives never fold.
  return { kind: "insert" };
}
