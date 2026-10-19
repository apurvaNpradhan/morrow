import type { ProjectColumnRow } from "@morrow/sync-schemas";

export type CompletionSegment = {
  column: ProjectColumnRow;
  count: number;
  /** Tasks in the segments before this one, where its arc starts. */
  before: number;
};

/**
 * A Project's tasks by Column, in board order, and how much is done. Canceled
 * tasks are shown but are not work to do, so they stay out of the percentage:
 * done over everything that is not canceled.
 */
export function completion(
  columns: readonly ProjectColumnRow[],
  counts: readonly { columnId: string; count: number }[],
) {
  const countOf = new Map(counts.map((row) => [row.columnId, row.count]));
  const segments: CompletionSegment[] = [];
  let total = 0;
  for (const column of columns) {
    const count = countOf.get(column.id) ?? 0;
    if (count === 0) continue;
    segments.push({ column, count, before: total });
    total += count;
  }
  const done = sum(segments, "done");
  const canceled = sum(segments, "canceled");
  const counted = total - canceled;
  return {
    segments,
    total,
    percent: counted === 0 ? 0 : Math.round((done / counted) * 100),
  };
}

function sum(segments: readonly CompletionSegment[], category: string) {
  return segments
    .filter((segment) => segment.column.category === category)
    .reduce((total, { count }) => total + count, 0);
}
