import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { taskError } from "#api/tasks/errors";
import { taskTable } from "#api/tasks/tables";

/** The parent a task is given: a task of the same Project, or a typed refusal. */
export async function findParent(
  tx: DbOrTx,
  projectId: string,
  parentId: string,
) {
  const [parent] = await tx
    .select()
    .from(taskTable)
    .where(and(eq(taskTable.id, parentId), eq(taskTable.projectId, projectId)));
  if (!parent) throw taskError("PARENT_NOT_IN_PROJECT");
  return parent;
}
