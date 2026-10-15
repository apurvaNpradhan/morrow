import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { taskNotFound } from "#api/tasks/errors";
import { taskTable } from "#api/tasks/tables";

/** A task of this project; any other task, including another project's, is "not found". */
export async function findTask(tx: DbOrTx, projectId: string, taskId: string) {
  const [task] = await tx
    .select()
    .from(taskTable)
    .where(and(eq(taskTable.id, taskId), eq(taskTable.projectId, projectId)));
  if (!task) throw taskNotFound();
  return task;
}
