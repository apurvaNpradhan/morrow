import { checklistCounts } from "@morrow/sync-schemas";
import type { DbOrTx } from "#api/members/index";
import { taskDescriptionTable } from "#api/tasks/tables";

/** The task columns derived from a description: its checklist progress. */
export function checklistColumns(description: string) {
  const { done, total } = checklistCounts(description);
  return { checklistDone: done, checklistTotal: total };
}

/**
 * Writes a task's description row, creating it when the task has none yet.
 * The caller writes `checklistColumns(description)` on the task in the same
 * transaction.
 */
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
