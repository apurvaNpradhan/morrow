import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { utcNow } from "#api/platform/database/column-types";
import { workspaceTable } from "#api/workspace/tables";

/*
 * A Workspace's vocabulary of labels. Tasks point at them by id from
 * `task.label_ids`, which has no foreign key: label delete is the one path that
 * keeps it consistent (see `deleteLabel`). `position` is a fractional-index key
 * and is `COLLATE "C"` (set in the migration), as in the projects tables.
 */
export const labelTable = pgTable(
  "label",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
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
    index("label_workspaceId_idx").on(table.workspaceId),
    uniqueIndex("label_workspace_name_uidx").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
    uniqueIndex("label_workspace_position_uidx").on(
      table.workspaceId,
      table.position,
    ),
    check("label_color_check", sql`${table.color} ~ '^#[0-9a-f]{6}$'`),
  ],
);
