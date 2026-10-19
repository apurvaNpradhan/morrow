import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { lockProject } from "#api/projects/index";
import { projectTable } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import { taskTable } from "#api/tasks/tables";

/**
 * The tasks of a relation, with their Project's key, once every task is in the
 * Workspace; any other task is refused. Locks their Projects in id order, so
 * two relations over the same Projects cannot deadlock, and an archived
 * Project refuses the write as for any task write.
 */
export async function lockRelationTasks(
  tx: DbOrTx,
  workspaceId: string,
  taskIds: string[],
) {
  const ids = [...new Set(taskIds)];
  const tasks = await tx
    .select({
      id: taskTable.id,
      number: taskTable.number,
      projectId: taskTable.projectId,
      projectKey: projectTable.key,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        inArray(taskTable.id, ids),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (tasks.length !== ids.length) {
    throw taskError("RELATION_TASK_NOT_IN_WORKSPACE");
  }
  for (const projectId of [...new Set(tasks.map((t) => t.projectId))].sort()) {
    await lockProject(tx, workspaceId, projectId);
  }
  return tasks;
}
