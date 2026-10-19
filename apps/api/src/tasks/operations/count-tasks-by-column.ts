import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectTable } from "#api/projects/index";
import { taskTable } from "#api/tasks/tables";

/**
 * How many unarchived tasks each Column of a Project holds, in one grouped
 * count. Columns with no tasks are left out.
 */
export async function countTasksByColumn(
  workspaceId: string,
  projectId: string,
) {
  return db
    .select({ columnId: taskTable.columnId, count: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        eq(taskTable.projectId, projectId),
        isNull(taskTable.archivedAt),
      ),
    )
    .groupBy(taskTable.columnId);
}
