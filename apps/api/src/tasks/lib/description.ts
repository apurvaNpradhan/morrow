import type { DbOrTx } from "#api/members/index";
import { taskDescriptionTable } from "#api/tasks/tables";

/** Writes a task's description row, creating it when the task has none yet. */
export async function saveDescription(
  tx: DbOrTx,
  projectId: string,
  taskId: string,
  description: string,
) {
  await tx
    .insert(taskDescriptionTable)
    .values({ taskId, projectId, description })
    .onConflictDoUpdate({
      target: taskDescriptionTable.taskId,
      set: { description },
    });
}
