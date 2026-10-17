import { MAX_TASK_LABELS } from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { findLabel, labelError } from "#api/labels/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { findTask } from "#api/tasks/lib/find-task";
import { taskTable } from "#api/tasks/tables";

/**
 * Puts a label on a task or takes it off. Both are idempotent and touch only
 * the label list (`array_append` when absent, `array_remove`), under the
 * project lock, so two people labelling one task at once both land. The label
 * must belong to the task's Workspace; applying it takes a share lock on the
 * label so a delete cannot strip the list before this write lands. `updatedAt`
 * always changes, so the write reaches sync even when nothing did.
 */
export async function setTaskLabel(
  workspaceId: string,
  projectId: string,
  taskId: string,
  labelId: string,
  applied: boolean,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    // Taking off a label that is already gone (or never was this Workspace's)
    // is not an error; it only leaves nothing to name in the history.
    const label = applied
      ? await findLabel(tx, workspaceId, labelId, "share")
      : await findLabel(tx, workspaceId, labelId).catch(() => undefined);
    if (
      applied &&
      !task.labelIds.includes(labelId) &&
      task.labelIds.length >= MAX_TASK_LABELS
    ) {
      throw labelError("LABEL_LIMIT_REACHED");
    }
    await tx
      .update(taskTable)
      .set({
        labelIds: applied
          ? sql`CASE WHEN ${labelId} = ANY(${taskTable.labelIds}) THEN ${taskTable.labelIds} ELSE array_append(${taskTable.labelIds}, ${labelId}) END`
          : sql`array_remove(${taskTable.labelIds}, ${labelId})`,
      })
      .where(eq(taskTable.id, taskId));
    if (label && task.labelIds.includes(labelId) !== applied) {
      const ref = { id: label.id, name: label.name, color: label.color };
      await recordTaskEvent(tx, projectId, taskId, {
        type: "labels",
        data: applied
          ? { added: [ref], removed: [] }
          : { added: [], removed: [ref] },
      });
    }
  });
  return { txid };
}
