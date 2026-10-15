import { createId } from "@paralleldrive/cuid2";
import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userTable } from "#api/auth/tables";
import { utcNow } from "#api/platform/database/column-types";
import { projectColumnTable, projectTable } from "#api/projects/tables";

/*
 * `position` is a fractional-index key and is `COLLATE "C"` (set in the
 * migration), as in the projects tables. `due_date` is a calendar day.
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
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority", { enum: TASK_PRIORITIES })
      .notNull()
      .default("none"),
    assigneeId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date", { mode: "string" }),
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
    index("task_columnId_idx").on(table.columnId),
    index("task_assigneeId_idx").on(table.assigneeId),
    uniqueIndex("task_project_number_uidx").on(table.projectId, table.number),
    uniqueIndex("task_column_position_uidx").on(table.columnId, table.position),
    check(
      "task_priority_check",
      sql`${table.priority} IN ('none', 'low', 'medium', 'high', 'urgent')`,
    ),
  ],
);
