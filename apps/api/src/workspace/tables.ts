import { createId } from "@paralleldrive/cuid2";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { utcNow } from "#api/platform/database/column-types";

export const workspaceTable = pgTable("workspace", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const workspaceSlugAliasTable = pgTable(
  "workspace_slug_alias",
  {
    slug: text("slug").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("workspace_slug_alias_workspaceId_idx").on(table.workspaceId),
  ],
);

export const workspaceRoleTable = pgTable(
  "workspace_role",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_role_workspaceId_idx").on(table.workspaceId),
    index("workspace_role_role_idx").on(table.role),
    uniqueIndex("workspace_role_workspaceId_role_uidx").on(
      table.workspaceId,
      table.role,
    ),
  ],
);
