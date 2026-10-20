import { claimAssets } from "#api/storage/index";
import type { DbOrTx } from "#api/members/index";
import { taskDescriptionTable } from "#api/tasks/tables";

/**
 * Writes a task's description row, creating it when the task has none yet, and
 * returns the text as stored: the files it links to are claimed for the task
 * first, which can swap a link for the task's own copy.
 */
export async function saveDescription(
  tx: DbOrTx,
  scope: {
    workspaceId: string;
    projectId: string;
    taskId: string;
    userId: string;
  },
  description: string,
) {
  const stored = await claimAssets(tx, scope, description);
  await tx
    .insert(taskDescriptionTable)
    .values({
      taskId: scope.taskId,
      projectId: scope.projectId,
      description: stored,
    })
    .onConflictDoUpdate({
      target: taskDescriptionTable.taskId,
      set: { description: stored },
    });
  return stored;
}
