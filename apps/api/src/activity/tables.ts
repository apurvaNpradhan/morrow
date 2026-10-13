import { createId } from "@paralleldrive/cuid2";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { utcNow } from "#api/platform/database/column-types";
import { userTable } from "#api/auth/tables";
import { workspaceTable } from "#api/workspace/tables";

export const activityTable = pgTable(
  "activity",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    actorUserId: text("actor_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    content: text("content"),
    eventData: jsonb("event_data"),
  },
  (table) => [
    index("activity_workspace_recent_idx").on(
      table.workspaceId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
