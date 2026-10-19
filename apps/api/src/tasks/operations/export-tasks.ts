import { compareColumns, comparePosition } from "@morrow/sync-schemas";
import { asc, eq, sql } from "drizzle-orm";
import { labelTable } from "#api/labels/index";
import { db, schema } from "#api/platform/database/index";
import {
  projectColumnTable,
  projectFieldTable,
  projectNotFound,
  projectTable,
} from "#api/projects/index";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskTable,
} from "#api/tasks/tables";

/**
 * A project's tasks as a portable document: columns by name and category,
 * tasks in board order, assignees and comment authors by email (ids mean
 * nothing elsewhere), labels by name with the colours of those in use, and
 * comments, and the Project's Fields with their options, each task's values
 * by Field and option name. History is not exported.
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

  const fields = (
    await db
      .select()
      .from(projectFieldTable)
      .where(eq(projectFieldTable.projectId, projectId))
  ).sort(comparePosition);
  const fieldById = new Map(fields.map((field) => [field.id, field]));

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

  const workspaceLabels = await db
    .select()
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId))
    .orderBy(asc(labelTable.position));
  const labelById = new Map(workspaceLabels.map((label) => [label.id, label]));
  const usedLabelIds = new Set(rows.flatMap(({ task }) => task.labelIds));

  const commentRows = await db
    .select({
      comment: taskCommentTable,
      authorEmail: schema.userTable.email,
    })
    .from(taskCommentTable)
    .leftJoin(
      schema.userTable,
      eq(schema.userTable.id, taskCommentTable.authorId),
    )
    .where(eq(taskCommentTable.projectId, projectId))
    .orderBy(asc(taskCommentTable.createdAt), asc(taskCommentTable.id));
  const commentsByTask = new Map<string, typeof commentRows>();
  for (const row of commentRows) {
    const forTask = commentsByTask.get(row.comment.taskId) ?? [];
    forTask.push(row);
    commentsByTask.set(row.comment.taskId, forTask);
  }

  rows.sort(
    (a, b) =>
      (order.get(a.task.columnId) ?? 0) - (order.get(b.task.columnId) ?? 0) ||
      comparePosition(a.task, b.task),
  );

  return {
    project: { key: project.key, name: project.name },
    labels: workspaceLabels
      .filter((label) => usedLabelIds.has(label.id))
      .map(({ name, color }) => ({ name, color })),
    columns: columns.map(({ name, category }) => ({ name, category })),
    fields: fields.map(({ name, type, options }) => ({
      name,
      type,
      options: [...options]
        .sort(comparePosition)
        .map(({ name, color }) => ({ name, color })),
    })),
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
        labels: task.labelIds.flatMap((id) => {
          const label = labelById.get(id);
          return label ? [label.name] : [];
        }),
        fields: Object.fromEntries(
          Object.entries(task.fieldValues).flatMap(([fieldId, optionId]) => {
            const field = fieldById.get(fieldId);
            const option = field?.options.find((o) => o.id === optionId);
            return field && option ? [[field.name, option.name]] : [];
          }),
        ),
        comments: (commentsByTask.get(task.id) ?? []).map(
          ({ comment, authorEmail }) => ({
            authorEmail,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
            editedAt: comment.editedAt?.toISOString() ?? null,
          }),
        ),
      };
    }),
  };
}
