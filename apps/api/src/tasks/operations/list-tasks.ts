import {
  compareColumns,
  comparePosition,
  ticketId,
} from "@morrow/sync-schemas";
import { and, eq } from "drizzle-orm";
import { db, schema } from "#api/platform/database/index";
import { projectColumnTable, projectTable } from "#api/projects/index";
import { taskTable } from "#api/tasks/tables";

/**
 * Tasks of a workspace (or one of its projects) in board order: by column,
 * then by position. Read on the server for MCP and the account export; the web
 * app gets tasks through sync.
 */
export async function listTasks(workspaceId: string, projectId?: string) {
  const rows = await db
    .select({
      task: taskTable,
      projectKey: projectTable.key,
      column: projectColumnTable,
      assigneeName: schema.userTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      projectColumnTable,
      eq(projectColumnTable.id, taskTable.columnId),
    )
    .leftJoin(schema.userTable, eq(schema.userTable.id, taskTable.assigneeId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        projectId ? eq(taskTable.projectId, projectId) : undefined,
      ),
    );

  return rows
    .sort(
      (a, b) =>
        a.task.projectId.localeCompare(b.task.projectId) ||
        compareColumns(a.column, b.column) ||
        comparePosition(a.task, b.task),
    )
    .map(({ task, projectKey, column, assigneeName }) => ({
      ...task,
      ticketId: ticketId(projectKey, task.number),
      columnName: column.name,
      category: column.category,
      assigneeName,
    }));
}
