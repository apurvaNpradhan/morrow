import { compareColumns, comparePosition } from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "#api/platform/database/index";
import {
  projectColumnTable,
  projectNotFound,
  projectTable,
} from "#api/projects/index";
import { taskDescriptionTable, taskTable } from "#api/tasks/tables";

/**
 * A project's tasks as a portable document: columns by name and category,
 * tasks in board order, assignees by email (ids mean nothing elsewhere).
 */
export async function exportTasks(workspaceId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.id, projectId));
  if (!project || project.workspaceId !== workspaceId) throw projectNotFound();

  const columns = (
    await db
      .select()
      .from(projectColumnTable)
      .where(eq(projectColumnTable.projectId, projectId))
  ).sort(compareColumns);
  const order = new Map(columns.map((column, index) => [column.id, index]));
  const columnById = new Map(columns.map((column) => [column.id, column]));

  const rows = await db
    .select({
      task: taskTable,
      assigneeEmail: schema.userTable.email,
      description: sql<string>`coalesce(${taskDescriptionTable.description}, '')`,
    })
    .from(taskTable)
    .leftJoin(schema.userTable, eq(schema.userTable.id, taskTable.assigneeId))
    .leftJoin(
      taskDescriptionTable,
      eq(taskDescriptionTable.taskId, taskTable.id),
    )
    .where(eq(taskTable.projectId, projectId));

  rows.sort(
    (a, b) =>
      (order.get(a.task.columnId) ?? 0) - (order.get(b.task.columnId) ?? 0) ||
      comparePosition(a.task, b.task),
  );

  return {
    project: { key: project.key, name: project.name },
    columns: columns.map(({ name, category }) => ({ name, category })),
    tasks: rows.map(({ task, assigneeEmail, description }) => {
      const column = columnById.get(task.columnId);
      return {
        number: task.number,
        title: task.title,
        description,
        column: column?.name ?? "",
        category: column?.category ?? "unstarted",
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeEmail,
        completedAt: task.completedAt?.toISOString() ?? null,
        archivedAt: task.archivedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
      };
    }),
  };
}
