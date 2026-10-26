import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "#api/auth/tables";
import { bytea, utcNow } from "#api/platform/database/column-types";
import { projectTable } from "#api/projects/tables";
import { workspaceTable } from "#api/workspace/tables";

/*
 * The tree of pages. A page and its descendants share one `project_id`, or
 * none at the Workspace root. `parent_id` has no cascade: deleting a page moves
 * its children up (see `deleteDocument`). `position` is a fractional-index key
 * among siblings and is `COLLATE "C"` (set in the migration), as in the
 * projects tables. `archived_root_id` names the page whose archive hid this
 * one, so restoring that page restores exactly the pages it hid. This table is
 * synced; its content is a Yjs document on Durable Streams.
 */
export const documentTable = pgTable(
  "documents",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
    }),
    parentId: text("parent_id").references((): AnyPgColumn => documentTable.id),
    position: text("position").notNull(),
    title: text("title").notNull().default(""),
    icon: text("icon"),
    generation: integer("generation").notNull().default(1),
    overLimit: boolean("over_limit").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    archivedRootId: text("archived_root_id"),
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
    index("documents_workspaceId_idx").on(table.workspaceId),
    index("documents_projectId_idx").on(table.projectId),
    index("documents_parentId_idx").on(table.parentId),
    index("documents_archivedRootId_idx").on(table.archivedRootId),
    check(
      "documents_archived_root_check",
      sql`(${table.archivedAt} IS NULL) = (${table.archivedRootId} IS NULL)`,
    ),
  ],
);

/*
 * The record of a page's content, mirrored from its stream by the page job:
 * ProseMirror JSON, the Yjs state vector, and the derived markdown and text.
 * Not synced.
 */
export const documentBodyTable = pgTable("document_body", {
  documentId: text("doc_id")
    .primaryKey()
    .references(() => documentTable.id, { onDelete: "cascade" }),
  content: jsonb("content").notNull(),
  stateVector: bytea("state_vector").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  markdown: text("markdown").notNull().default(""),
  text: text("text").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const DOCUMENT_CLIENT_VIAS = ["web", "mcp", "agent", "system"] as const;

/*
 * Which user a Yjs client id belongs to, and through what. `user_id` has no
 * foreign key: text outlives its author's account and shows as "Deleted user".
 * Not synced.
 */
export const documentClientTable = pgTable(
  "document_clients",
  {
    documentId: text("doc_id")
      .notNull()
      .references(() => documentTable.id, { onDelete: "cascade" }),
    yjsClientId: bigint("yjs_client_id", { mode: "number" }).notNull(),
    userId: text("user_id").notNull(),
    via: text("via", { enum: DOCUMENT_CLIENT_VIAS }).notNull(),
    runId: text("run_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.yjsClientId] }),
    check(
      "document_clients_yjs_client_id_check",
      sql`${table.yjsClientId} BETWEEN 0 AND 4294967295`,
    ),
  ],
);
