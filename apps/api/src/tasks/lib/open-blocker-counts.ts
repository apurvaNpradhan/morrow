import { sql } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";

/**
 * Recomputes `open_blocker_count` of every Task the given tasks block: the
 * `blocks` relations targeting it whose source is open (neither closed nor
 * archived). Never adjusted by one. Call it as its own statement after the
 * write that changed a blocker, so a relation committed just before is seen.
 * The targets may be in other Projects and need no lock.
 */
export async function refreshBlockedCounts(
  tx: DbOrTx,
  blockerIds: Array<string | null | undefined>,
) {
  const ids = [...new Set(blockerIds.filter((id) => id != null))];
  if (ids.length === 0) return;
  await tx.execute(sql`
    UPDATE task SET open_blocker_count = ${openBlockers()}
    WHERE id IN (
      SELECT target_task_id FROM task_relation
      WHERE type = 'blocks' AND source_task_id IN (${sql.join(ids, sql`, `)}))`);
}

/** Recomputes `open_blocker_count` of the given tasks themselves. */
export async function refreshOpenBlockerCounts(
  tx: DbOrTx,
  targetIds: string[],
) {
  const ids = [...new Set(targetIds)];
  if (ids.length === 0) return;
  await tx.execute(sql`
    UPDATE task SET open_blocker_count = ${openBlockers()}
    WHERE id IN (${sql.join(ids, sql`, `)})`);
}

function openBlockers() {
  return sql`(SELECT count(*)::int FROM task_relation r
    JOIN task blocker ON blocker.id = r.source_task_id
    WHERE r.type = 'blocks' AND r.target_task_id = task.id
      AND blocker.completed_at IS NULL AND blocker.archived_at IS NULL)`;
}
