import type {
  TaskCommentRow,
  TaskEvent,
  TaskEventRow,
} from "@morrow/sync-schemas";
import { taskEventSchema } from "@morrow/sync-schemas";

/** A history entry as the timeline shows it: its row and its parsed payload. */
export type TimelineEvent = {
  row: TaskEventRow;
  event: TaskEvent;
};

export type TimelineItem =
  | { kind: "comment"; at: Date; comment: TaskCommentRow }
  | { kind: "event"; at: Date; event: TimelineEvent }
  /** Two or more bookkeeping entries in a row, folded behind one line. */
  | { kind: "fold"; at: Date; events: TimelineEvent[]; groups: FoldGroup[] };

/** What a folded entry is about, for the line that names what is inside. */
export type FoldGroup = "relations" | "subtasks" | "parent";

/** The fewest consecutive bookkeeping entries that fold into "Show N events". */
export const FOLD_AT = 2;

/** The group of an entry that folds; the rest (status, priority…) always show. */
export function foldGroup(event: TaskEvent): FoldGroup | null {
  switch (event.type) {
    case "relation_added":
    case "relation_removed":
      return "relations";
    case "subtask_added":
    case "subtask_removed":
      return "subtasks";
    case "parent":
      return "parent";
    default:
      return null;
  }
}

/** Parses history rows; an entry this version does not understand is left out. */
export function parseEvents(rows: readonly TaskEventRow[]): TimelineEvent[] {
  return rows.flatMap((row) => {
    const parsed = taskEventSchema.safeParse({
      type: row.type,
      data: row.data,
    });
    return parsed.success ? [{ row, event: parsed.data }] : [];
  });
}

/**
 * Comments and history in one list, oldest first. A run of `FOLD_AT` or more
 * relation, subtask and parent entries, with nothing else between them, becomes
 * one folded item; every other kind of change keeps its own line, and
 * comments always show.
 */
export function buildTimeline(
  comments: readonly TaskCommentRow[],
  events: readonly TimelineEvent[],
): TimelineItem[] {
  const entries: Array<
    | { kind: "comment"; at: Date; id: string; comment: TaskCommentRow }
    | { kind: "event"; at: Date; id: string; event: TimelineEvent }
  > = [
    ...comments.map((comment) => ({
      kind: "comment" as const,
      at: comment.createdAt,
      id: comment.id,
      comment,
    })),
    ...events.map((event) => ({
      kind: "event" as const,
      at: event.row.createdAt,
      id: event.row.id,
      event,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || (a.id < b.id ? -1 : 1));

  const items: TimelineItem[] = [];
  let run: TimelineEvent[] = [];
  function flush() {
    const first = run[0];
    if (!first) return;
    if (run.length >= FOLD_AT) {
      const groups = new Set<FoldGroup>();
      for (const { event } of run) groups.add(foldGroup(event)!);
      items.push({
        kind: "fold",
        at: first.row.createdAt,
        events: run,
        groups: [...groups],
      });
    } else {
      for (const event of run) {
        items.push({ kind: "event", at: event.row.createdAt, event });
      }
    }
    run = [];
  }
  for (const entry of entries) {
    if (entry.kind === "event" && foldGroup(entry.event.event) !== null) {
      run.push(entry.event);
      continue;
    }
    flush();
    items.push(
      entry.kind === "comment"
        ? { kind: "comment", at: entry.at, comment: entry.comment }
        : { kind: "event", at: entry.at, event: entry.event },
    );
  }
  flush();
  return items;
}
