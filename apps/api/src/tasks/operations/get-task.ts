import { parseTicketId, relationKind, ticketId } from "@morrow/sync-schemas";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { labelTable } from "#api/labels/index";
import { db, schema } from "#api/platform/database/index";
import {
  projectColumnTable,
  projectNotFound,
  projectTable,
} from "#api/projects/index";
import { taskNotFound } from "#api/tasks/errors";
import { findTicketTaskId } from "#api/tasks/lib/find-ticket";
import {
  fieldsOfProjects,
  namedFieldValues,
} from "#api/tasks/lib/named-field-values";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskLinkTable,
  taskRelationTable,
  taskTable,
} from "#api/tasks/tables";
import { dueText, startText } from "#api/tasks/lib/task-date-columns";

/**
 * One task by ticket id with what the list leaves out: its description, its
 * labels (names and colours) and its comments, oldest first. History is not
 * included. A ticket id of another project is "not found". A ticket id a
 * moved task left behind finds the task, which reports its current ticket id
 * and project.
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
  const taskId = await findTicketTaskId(db, projectId, parsed.number);
  if (!taskId) throw taskNotFound();

  const [found] = await db
    .select({
      task: taskTable,
      project: projectTable,
      column: projectColumnTable,
      assigneeName: schema.userTable.name,
      description: sql<string>`coalesce(${taskDescriptionTable.description}, '')`,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
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
      and(eq(taskTable.id, taskId), eq(projectTable.workspaceId, workspaceId)),
    );
  if (!found) throw taskNotFound();
  const { task, column, project: home } = found;
  const [parent] = task.parentId
    ? await db
        .select({ number: taskTable.number, title: taskTable.title })
        .from(taskTable)
        .where(eq(taskTable.id, task.parentId))
    : [];

  const fieldById = await fieldsOfProjects([home.id]);
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

  // The other end of each relation, which may be in another Project.
  const other = alias(taskTable, "other");
  const relationRows = await db
    .select({
      id: taskRelationTable.id,
      type: taskRelationTable.type,
      outgoing: eq(taskRelationTable.sourceTaskId, task.id),
      number: other.number,
      title: other.title,
      key: projectTable.key,
    })
    .from(taskRelationTable)
    .innerJoin(
      other,
      eq(
        other.id,
        sql`CASE WHEN ${taskRelationTable.sourceTaskId} = ${task.id} THEN ${taskRelationTable.targetTaskId} ELSE ${taskRelationTable.sourceTaskId} END`,
      ),
    )
    .innerJoin(projectTable, eq(projectTable.id, other.projectId))
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, task.id),
        eq(taskRelationTable.targetTaskId, task.id),
      ),
    )
    .orderBy(asc(taskRelationTable.createdAt), asc(taskRelationTable.id));

  return {
    id: task.id,
    projectId: home.id,
    ticketId: ticketId(home.key, task.number),
    parent: parent
      ? { ticketId: ticketId(home.key, parent.number), title: parent.title }
      : null,
    subtaskDone: task.subtaskDone,
    subtaskTotal: task.subtaskTotal,
    openBlockerCount: task.openBlockerCount,
    title: task.title,
    description: found.description,
    column: column.name,
    category: column.category,
    priority: task.priority,
    assignee:
      task.assigneeId && found.assigneeName
        ? { id: task.assigneeId, name: found.assigneeName }
        : null,
    startDate: startText(task),
    dueDate: dueText(task),
    recurrence: task.recurrence,
    completedAt: task.completedAt,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    fields: namedFieldValues(task.fieldValues, fieldById),
    labels: labels
      .filter((label) => task.labelIds.includes(label.id))
      .map(({ name, color }) => ({ name, color })),
    links,
    relations: relationRows.map((row) => {
      const direction = row.outgoing ? "outgoing" : "incoming";
      return {
        id: row.id,
        type: row.type,
        direction,
        kind: relationKind(row.type, direction),
        ticketId: ticketId(row.key, row.number),
        title: row.title,
      } as const;
    }),
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
