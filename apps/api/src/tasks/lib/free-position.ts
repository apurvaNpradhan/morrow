import { and, asc, eq, gte, ne } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { DbOrTx } from "#api/members/index";
import { taskTable } from "#api/tasks/tables";

/**
 * The position a task takes in a column when its client asked for
 * `requested`. The browser picks it between the neighbours it can see, but
 * archived tasks keep their positions in the column and are not loaded, so the
 * slot can already be held. Then the task goes right after the holder, before
 * the next one, which is still between the neighbours the user saw. The caller
 * holds the project's lock, so nobody else claims the slot meanwhile.
 */
export async function freePosition(
  tx: DbOrTx,
  columnId: string,
  requested: string,
  movingTaskId?: string,
) {
  const [holder, next] = await tx
    .select({ position: taskTable.position })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.columnId, columnId),
        gte(taskTable.position, requested),
        movingTaskId ? ne(taskTable.id, movingTaskId) : undefined,
      ),
    )
    .orderBy(asc(taskTable.position))
    .limit(2);
  if (holder?.position !== requested) return requested;
  return generateKeyBetween(requested, next?.position ?? null);
}
