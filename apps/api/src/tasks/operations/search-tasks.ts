import {
  COLUMN_CATEGORIES,
  isClosedCategory,
  type TaskPriority,
  ticketId,
} from "@morrow/sync-schemas";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { labelTable } from "#api/labels/index";
import { db, schema } from "#api/platform/database/index";
import { projectColumnTable, projectTable } from "#api/projects/index";
import {
  fieldsOfProjects,
  namedFieldValues,
} from "#api/tasks/lib/named-field-values";
import { taskDescriptionTable, taskTable } from "#api/tasks/tables";
import { dueText, startText } from "#api/tasks/lib/task-date-columns";

export const SEARCH_TASKS_MAX = 200;

const CLOSED_CATEGORIES = COLUMN_CATEGORIES.filter(isClosedCategory);

export type TaskSearch = {
  projectId?: string;
  /** A member's user id. */
  assigneeId?: string;
  /** A member's email, any letter case. */
  assigneeEmail?: string;
  /** A label's name, any letter case. */
  label?: string;
  /** A column's name, any letter case. */
  column?: string;
  priority?: TaskPriority;
  /** Tasks in a closed column (done or canceled), or in any other column. */
  state?: "open" | "closed";
  /** Matched case-insensitively against title and description. */
  query?: string;
  includeArchived: boolean;
  limit: number;
};

/** Escapes `%`, `_` and `\` so a query is matched literally by ILIKE. */
function containsPattern(text: string) {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Tasks of a workspace, or of one of its projects, that match every filter
 * given, in board order, in a single query. Returns at most `limit` and says
 * whether more matched. Archived tasks are left out unless asked for.
 */
export async function searchTasks(workspaceId: string, search: TaskSearch) {
  const limit = Math.min(search.limit, SEARCH_TASKS_MAX);
  const query = search.query?.trim();
  const categoryRank = sql`CASE ${projectColumnTable.category} ${sql.join(
    COLUMN_CATEGORIES.map(
      (category, index) => sql`WHEN ${category} THEN ${index}`,
    ),
    sql` `,
  )} END`;

  const rows = await db
    .select({
      task: taskTable,
      projectKey: projectTable.key,
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
      and(
        eq(projectTable.workspaceId, workspaceId),
        search.projectId
          ? eq(taskTable.projectId, search.projectId)
          : undefined,
        search.includeArchived ? undefined : isNull(taskTable.archivedAt),
        search.assigneeId
          ? eq(taskTable.assigneeId, search.assigneeId)
          : undefined,
        search.assigneeEmail
          ? sql`lower(${schema.userTable.email}) = ${search.assigneeEmail.trim().toLowerCase()}`
          : undefined,
        search.column
          ? sql`lower(${projectColumnTable.name}) = ${search.column.trim().toLowerCase()}`
          : undefined,
        search.label
          ? sql`exists (select 1 from ${labelTable} where ${labelTable.workspaceId} = ${workspaceId} and ${labelTable.id} = any(${taskTable.labelIds}) and lower(${labelTable.name}) = ${search.label.trim().toLowerCase()})`
          : undefined,
        search.priority ? eq(taskTable.priority, search.priority) : undefined,
        search.state
          ? search.state === "closed"
            ? inArray(projectColumnTable.category, [...CLOSED_CATEGORIES])
            : notInArray(projectColumnTable.category, [...CLOSED_CATEGORIES])
          : undefined,
        query
          ? or(
              ilike(taskTable.title, containsPattern(query)),
              ilike(taskDescriptionTable.description, containsPattern(query)),
            )
          : undefined,
      ),
    )
    .orderBy(
      asc(projectTable.key),
      asc(categoryRank),
      sql`${projectColumnTable.position} COLLATE "C"`,
      sql`${taskTable.position} COLLATE "C"`,
      asc(taskTable.id),
    )
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const parentIds = page.flatMap(({ task }) => task.parentId ?? []);
  const parents =
    parentIds.length === 0
      ? []
      : await db
          .select({ id: taskTable.id, number: taskTable.number })
          .from(taskTable)
          .where(inArray(taskTable.id, parentIds));
  const parentNumber = new Map(parents.map((p) => [p.id, p.number]));

  const labels = await db
    .select({ id: labelTable.id, name: labelTable.name })
    .from(labelTable)
    .where(eq(labelTable.workspaceId, workspaceId));
  const labelName = new Map(labels.map((label) => [label.id, label.name]));
  const fieldById = await fieldsOfProjects([
    ...new Set(page.map(({ task }) => task.projectId)),
  ]);

  return {
    truncated: rows.length > limit,
    tasks: page.map(
      ({ task, projectKey, column, assigneeName, description }) => {
        const parent = task.parentId ? parentNumber.get(task.parentId) : null;
        return {
          ticketId: ticketId(projectKey, task.number),
          parentTicketId: parent == null ? null : ticketId(projectKey, parent),
          subtaskDone: task.subtaskDone,
          subtaskTotal: task.subtaskTotal,
          openBlockerCount: task.openBlockerCount,
          projectKey,
          title: task.title,
          description,
          columnName: column.name,
          category: column.category,
          priority: task.priority,
          assigneeId: task.assigneeId,
          assigneeName,
          startDate: startText(task),
          dueDate: dueText(task),
          labels: task.labelIds.flatMap((id) => labelName.get(id) ?? []),
          fields: namedFieldValues(task.fieldValues, fieldById),
          completedAt: task.completedAt,
          archivedAt: task.archivedAt,
        };
      },
    ),
  };
}
