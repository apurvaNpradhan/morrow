import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import { findParent } from "#api/tasks/lib/find-parent";
import { findTask } from "#api/tasks/lib/find-task";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { recordParentChange } from "#api/tasks/history/record-parent-change";
import { taskTable } from "#api/tasks/tables";

/**
 * Sets or clears a task's parent (`null` makes it top-level). The parent must
 * be a task of the same Project and may not be the task or anything under it.
 * Both the old and the new parent's counters are recomputed, and the change is
 * recorded in the history of all three tasks.
 */
export async function setTaskParent(
  workspaceId: string,
  projectId: string,
  taskId: string,
  parentId: string | null,
) {
  const { txid } = await withTxid(async (tx) => {
    const project = await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    const next = parentId ? await findParent(tx, projectId, parentId) : null;
    if (next) {
      // The parent and everything above it; reaching the task is a loop.
      const loop = await tx.execute(sql`
        WITH RECURSIVE ancestors(id, parent_id) AS (
          SELECT id, parent_id FROM task WHERE id = ${next.id}
          UNION
          SELECT t.id, t.parent_id FROM task t JOIN ancestors a ON t.id = a.parent_id
        )
        SELECT 1 FROM ancestors WHERE id = ${taskId} LIMIT 1`);
      if (loop.rows.length > 0) throw taskError("PARENT_CYCLE");
    }
    const previous = task.parentId
      ? await findTask(tx, projectId, task.parentId)
      : null;

    await tx
      .update(taskTable)
      .set({ parentId: next?.id ?? null })
      .where(eq(taskTable.id, taskId));
    await refreshSubtaskCounts(tx, [previous?.id, next?.id]);
    await recordParentChange(tx, project, task, previous, next);
  });
  return { txid };
}
