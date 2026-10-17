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
  /** Three or more history entries in a row, folded behind one line. */
  | { kind: "fold"; at: Date; events: TimelineEvent[] };

/** The fewest consecutive entries that fold into "N more changes". */
export const FOLD_AT = 3;

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
 * history entries with no comment between them becomes one folded item, so a
 * long run of edits does not bury the conversation.
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
      items.push({ kind: "fold", at: first.row.createdAt, events: run });
    } else {
      for (const event of run) {
        items.push({ kind: "event", at: event.row.createdAt, event });
      }
    }
    run = [];
  }
  for (const entry of entries) {
    if (entry.kind === "event") {
      run.push(entry.event);
    } else {
      flush();
      items.push({ kind: "comment", at: entry.at, comment: entry.comment });
    }
  }
  flush();
  return items;
}
