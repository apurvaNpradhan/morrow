import { inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { taskTable } from "#api/tasks/tables";

/**
 * Recomputes the subtask counters of the given parents from their rows: the
 * direct subtasks that are not archived, and those of them closed. Never
 * adjusted by one, so any write path can call it and a missed call heals on
 * the next. Call it after the write, under the Project lock.
 */
export async function refreshSubtaskCounts(
  tx: DbOrTx,
  parentIds: Array<string | null | undefined>,
) {
  const ids = [...new Set(parentIds.filter((id) => id != null))];
  if (ids.length === 0) return;
  const children = (extra = sql``) =>
    sql`(SELECT count(*)::int FROM task AS child WHERE child.parent_id = ${taskTable.id} AND child.archived_at IS NULL ${extra})`;
  await tx
    .update(taskTable)
    .set({
      subtaskTotal: children(),
      subtaskDone: children(sql`AND child.completed_at IS NOT NULL`),
    })
    .where(inArray(taskTable.id, ids));
}
