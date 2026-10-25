import { createId } from "@paralleldrive/cuid2";
import {
  type FieldValues,
  RELATION_TYPES,
  TASK_PRIORITIES,
} from "@morrow/sync-schemas";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userTable } from "#api/auth/tables";
import { utcNow } from "#api/platform/database/column-types";
import { projectColumnTable, projectTable } from "#api/projects/tables";
import { workspaceTable } from "#api/workspace/tables";

/*
 * `position` is a fractional-index key and is `COLLATE "C"` (set in the
 * migration), as in the projects tables. `due_at` is a day (00:00 UTC, with
 * `due_has_time` false) or a moment; see `task-dates.ts` in sync-schemas.
 */

export const taskTable = pgTable(
  "task",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    // Column delete moves its tasks first, so a Column in use cannot be
    // deleted. "No action" (not "restrict") lets a Project delete cascade to
    // its Columns and tasks in one statement.
    columnId: text("column_id")
      .notNull()
      .references(() => projectColumnTable.id),
    // A subtask's parent, in the same Project (Tasks never change Project).
    // Deleting the parent keeps its subtasks as top-level tasks.
    parentId: text("parent_id").references((): AnyPgColumn => taskTable.id, {
      onDelete: "set null",
    }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    // Recomputed from the rows of the direct subtasks (see
    // `refreshSubtaskCounts`): those not archived, and those of them closed.
    subtaskDone: integer("subtask_done").notNull().default(0),
    subtaskTotal: integer("subtask_total").notNull().default(0),
    // Recomputed from the `blocks` relations targeting the task whose source is
    // open (see `refreshBlockedCounts`); a card shows "blocked" above 0.
    openBlockerCount: integer("open_blocker_count").notNull().default(0),
    // Kept by the Procedures that create and delete comments, so a card shows
    // a badge without the comments themselves.
    commentCount: integer("comment_count").notNull().default(0),
    priority: text("priority", { enum: TASK_PRIORITIES })
      .notNull()
      .default("none"),
    assigneeId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    startAt: timestamp("start_at", { mode: "date" }),
    startHasTime: boolean("start_has_time").notNull().default(false),
    dueAt: timestamp("due_at", { mode: "date" }),
    dueHasTime: boolean("due_has_time").notNull().default(false),
    // An RFC 5545 rule (DTSTART + RRULE) whose DTSTART is the due date; see `recurrence.ts` in sync-schemas.
    recurrence: text("recurrence"),
    // Ids of the Workspace's labels. No foreign key, on purpose: one row per
    // task, read straight off the card. Label delete keeps it consistent.
    labelIds: text("label_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Custom Field values keyed by Field id (option id, or ids for a multi
    // choice, for a choice Field; see `FieldValue`). A
    // value not set is a missing key, never null. No foreign key, like
    // `label_ids`: Field and option delete keep it consistent.
    fieldValues: jsonb("field_values")
      .$type<FieldValues>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: text("position").notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    // Search: words (stemmed) and half-typed or misspelled words in titles.
    index("task_title_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title})`,
    ),
    index("task_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
    index("task_columnId_idx").on(table.columnId),
    index("task_assigneeId_idx").on(table.assigneeId),
    index("task_parentId_idx").on(table.parentId),
    uniqueIndex("task_project_number_uidx").on(table.projectId, table.number),
    uniqueIndex("task_column_position_uidx").on(table.columnId, table.position),
    check(
      "task_due_has_time_check",
      sql`${table.dueAt} IS NOT NULL OR NOT ${table.dueHasTime}`,
    ),
    check(
      "task_start_has_time_check",
      sql`${table.startAt} IS NOT NULL OR NOT ${table.startHasTime}`,
    ),
    // A day is 00:00 UTC, so a day and a moment compare by that.
    check(
      "task_start_before_due_check",
      sql`${table.startAt} IS NULL OR ${table.dueAt} IS NULL OR ${table.startAt} <= ${table.dueAt}`,
    ),
    check(
      "task_recurrence_needs_due_check",
      sql`${table.recurrence} IS NULL OR ${table.dueAt} IS NOT NULL`,
    ),
    check(
      "task_recurrence_not_subtask_check",
      sql`${table.recurrence} IS NULL OR ${table.parentId} IS NULL`,
    ),
    check(
      "task_priority_check",
      sql`${table.priority} IN ('none', 'low', 'medium', 'high', 'urgent')`,
    ),
  ],
);

/*
 * A Ticket id a Task left when it moved to another Project: the Project it was
 * in and the number it had there. Lookup tries the live `(project, number)`
 * first, then this table, so the old id keeps resolving. Numbers are never
 * reused, so a row never clashes with a live Task, and a Task moving back
 * takes its old number again and deletes the row. It keys on the Project, not
 * its key, so a key rename leaves it working.
 */
export const taskTicketAliasTable = pgTable(
  "task_ticket_alias",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.number] }),
    index("task_ticket_alias_taskId_idx").on(table.taskId),
  ],
);

/*
 * A task's markdown, apart from the task so the synced task rows stay small.
 * Every task has exactly one row, written in the same transaction as the task.
 * `project_id` repeats the task's so the shape can be scoped by membership
 * without a join.
 */
export const taskDescriptionTable = pgTable(
  "task_description",
  {
    taskId: text("task_id")
      .primaryKey()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
  },
  (table) => [
    index("task_description_projectId_idx").on(table.projectId),
    index("task_description_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.description})`,
    ),
  ],
);

/*
 * A markdown message on a task. `project_id` repeats the task's so the shape
 * can be scoped by membership without a join. The author is set null when the
 * account goes; the comment stays and reads "Deleted user".
 */
export const taskCommentTable = pgTable(
  "task_comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_comment_task_created_idx").on(table.taskId, table.createdAt),
    index("task_comment_projectId_idx").on(table.projectId),
    index("task_comment_body_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.body})`,
    ),
  ],
);

/*
 * A URL attached to a task. `project_id` repeats the task's so the shape can be
 * scoped by membership without a join. A task has a URL once; the server never
 * fetches the page.
 */
export const taskLinkTable = pgTable(
  "task_link",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("task_link_task_url_uidx").on(table.taskId, table.url),
    index("task_link_projectId_idx").on(table.projectId),
  ],
);

/*
 * What happened to a task, written by the Procedures that change it (see
 * `recordTaskEvent`). `data` is the payload of `type`, shaped by
 * `taskEventSchema`. `project_id` repeats the task's for shape scoping.
 */
export const taskEventTable = pgTable(
  "task_event",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("task_event_task_created_idx").on(table.taskId, table.createdAt),
    index("task_event_projectId_idx").on(table.projectId),
  ],
);

/*
 * A relation between two tasks of a Workspace, which may be in different
 * Projects. `blocks`: the source blocks the target; `duplicate`: the source is
 * a duplicate of the target; `related`: the ids are stored in sorted order, so
 * a pair has one row. `workspace_id` is there for shape scoping.
 */
export const taskRelationTable = pgTable(
  "task_relation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: RELATION_TYPES }).notNull(),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => taskTable.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    uniqueIndex("task_relation_type_source_target_uidx").on(
      table.type,
      table.sourceTaskId,
      table.targetTaskId,
    ),
    index("task_relation_sourceTaskId_idx").on(table.sourceTaskId),
    index("task_relation_targetTaskId_idx").on(table.targetTaskId),
    index("task_relation_workspaceId_idx").on(table.workspaceId),
    check(
      "task_relation_type_check",
      sql`${table.type} IN ('blocks', 'related', 'duplicate')`,
    ),
    check(
      "task_relation_distinct_check",
      sql`${table.sourceTaskId} <> ${table.targetTaskId}`,
    ),
  ],
);
