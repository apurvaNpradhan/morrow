import { createId } from "@paralleldrive/cuid2";
import {
  COLUMN_CATEGORIES,
  FIELD_TYPES,
  type FieldOption,
} from "@morrow/sync-schemas";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { utcNow } from "#api/platform/database/column-types";
import { workspaceTable } from "#api/workspace/tables";

/*
 * `position` columns hold fractional-index keys and are `COLLATE "C"` (set in
 * the migration), so Postgres orders them by bytes as the library requires.
 */

export const projectTable = pgTable(
  "project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    backgroundUrl: text("background_url"),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    lastTaskNumber: integer("last_task_number").notNull().default(0),
    position: text("position").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_workspace_key_uidx").on(table.workspaceId, table.key),
    uniqueIndex("project_workspace_position_uidx").on(
      table.workspaceId,
      table.position,
    ),
    check("project_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
  ],
);

export const projectColumnTable = pgTable(
  "project_column",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category", { enum: COLUMN_CATEGORIES }).notNull(),
    color: text("color").notNull(),
    position: text("position").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_column_projectId_idx").on(table.projectId),
    uniqueIndex("project_column_project_name_uidx").on(
      table.projectId,
      sql`lower(${table.name})`,
    ),
    uniqueIndex("project_column_position_uidx").on(
      table.projectId,
      table.category,
      table.position,
    ),
    check(
      "project_column_category_check",
      sql`${table.category} IN ('backlog', 'unstarted', 'started', 'done', 'canceled')`,
    ),
    check("project_column_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
  ],
);

/*
 * A custom Field of a Project. `options` holds a choice Field's choices as
 * `{ id, name, color, position }`; Tasks store the option id in
 * `task.field_values`, so renaming or recolouring an option rewrites only this
 * row. Delete cascades strip the values (see `deleteField`, `deleteFieldOption`).
 */
export const projectFieldTable = pgTable(
  "project_field",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: FIELD_TYPES }).notNull(),
    position: text("position").notNull(),
    options: jsonb("options")
      .$type<FieldOption[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_field_projectId_idx").on(table.projectId),
    uniqueIndex("project_field_project_name_uidx").on(
      table.projectId,
      sql`lower(${table.name})`,
    ),
    uniqueIndex("project_field_position_uidx").on(
      table.projectId,
      table.position,
    ),
    check("project_field_type_check", sql`${table.type} IN ('single_choice')`),
  ],
);
