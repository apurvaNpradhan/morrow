import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { assertRecurrence, dueOf } from "#api/tasks/lib/recurrence";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { taskTable } from "#api/tasks/tables";

/**
 * Sets a task's repeat rule (an RFC 5545 string whose DTSTART is its due date)
 * or removes it with null, which ends the series. A task needs a due date to
 * repeat, and a subtask cannot repeat.
 */
export async function setTaskRecurrence(
  workspaceId: string,
  projectId: string,
  taskId: string,
  recurrence: string | null,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    if (recurrence !== null) {
      if (task.parentId !== null) throw taskError("SUBTASK_CANNOT_REPEAT");
      assertRecurrence(recurrence, dueOf(task));
    }
    // `updatedAt` always changes, so the write reaches sync even when the value did not.
    await tx
      .update(taskTable)
      .set({ recurrence, updatedAt: new Date() })
      .where(eq(taskTable.id, taskId));
    if (recurrence !== task.recurrence) {
      await recordTaskEvent(tx, projectId, taskId, {
        type: "recurrence",
        data: { from: task.recurrence, to: recurrence },
      });
    }
  });
  return { txid };
}
