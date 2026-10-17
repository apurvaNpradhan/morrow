import { parseTicketId, ticketId } from "@morrow/sync-schemas";
import { and, asc, eq, sql } from "drizzle-orm";
import { labelTable } from "#api/labels/index";
import { db, schema } from "#api/platform/database/index";
import {
  projectColumnTable,
  projectNotFound,
  projectTable,
} from "#api/projects/index";
import { taskNotFound } from "#api/tasks/errors";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskLinkTable,
  taskTable,
} from "#api/tasks/tables";

/**
 * One task by ticket id with what the list leaves out: its description, its
 * labels (names and colours) and its comments, oldest first. History is not
 * included. A ticket id of another project is "not found".
 */
export async function getTask(
  workspaceId: string,
  projectId: string,
  ticket: string,
) {
  const [project] = await db
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (!project) throw projectNotFound();
  const parsed = parseTicketId(ticket);
  if (!parsed || parsed.key !== project.key) throw taskNotFound();

  const [found] = await db
    .select({
      task: taskTable,
      column: projectColumnTable,
      assigneeName: schema.userTable.name,
      description: sql<string>`coalesce(${taskDescriptionTable.description}, '')`,
    })
    .from(taskTable)
    .innerJoin(
      projectColumnTable,
      eq(projectColumnTable.id, taskTable.columnId),
    )
    .leftJoin(schema.userTable, eq(schema.userTable.id, taskTable.assigneeId))
    .leftJoin(
      taskDescriptionTable,
      eq(taskDescriptionTable.taskId, taskTable.id),
    )
    .where(
      and(
        eq(taskTable.projectId, projectId),
        eq(taskTable.number, parsed.number),
      ),
    );
  if (!found) throw taskNotFound();
  const { task, column } = found;

  const labels = await db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
    })
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId))
    .orderBy(asc(labelTable.position));
  const comments = await db
    .select({
      id: taskCommentTable.id,
      authorId: taskCommentTable.authorId,
      authorName: schema.userTable.name,
      body: taskCommentTable.body,
      createdAt: taskCommentTable.createdAt,
      editedAt: taskCommentTable.editedAt,
    })
    .from(taskCommentTable)
    .leftJoin(
      schema.userTable,
      eq(schema.userTable.id, taskCommentTable.authorId),
    )
    .where(eq(taskCommentTable.taskId, task.id))
    .orderBy(asc(taskCommentTable.createdAt), asc(taskCommentTable.id));

  const links = await db
    .select({
      id: taskLinkTable.id,
      url: taskLinkTable.url,
      title: taskLinkTable.title,
    })
    .from(taskLinkTable)
    .where(eq(taskLinkTable.taskId, task.id))
    .orderBy(asc(taskLinkTable.createdAt), asc(taskLinkTable.id));

  return {
    id: task.id,
    ticketId: ticketId(project.key, task.number),
    title: task.title,
    description: found.description,
    column: column.name,
    category: column.category,
    priority: task.priority,
    assignee:
      task.assigneeId && found.assigneeName
        ? { id: task.assigneeId, name: found.assigneeName }
        : null,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    labels: labels
      .filter((label) => task.labelIds.includes(label.id))
      .map(({ name, color }) => ({ name, color })),
    links,
    comments: comments.map((comment) => ({
      id: comment.id,
      author:
        comment.authorId && comment.authorName
          ? { id: comment.authorId, name: comment.authorName }
          : null,
      body: comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
    })),
  };
}
