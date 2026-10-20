import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { utcNow } from "#api/platform/database/column-types";
import { userTable } from "#api/auth/tables";
import { taskTable } from "#api/tasks/tables";
import { workspaceTable } from "#api/workspace/tables";

/**
 * A file attached to markdown. It starts as a draft, visible only to its
 * uploader (`attached_at` null), and becomes the task's when a saved
 * description or comment links to it. Deleting the task deletes the row; the
 * object goes with the nightly sweep. Not synced: the markdown carries what
 * the editor shows. Decision: `docs/adr/0010-attachments.md`.
 */
export const assetTable = pgTable(
  "asset",
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
    // The container. Documents will add `document_id` beside it.
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
    }),
    // The asset this one was copied from, so saving the same link twice makes
    // one copy. No foreign key: the copy outlives its source.
    sourceAssetId: text("source_asset_id"),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    kind: text("kind", { enum: ["image", "file"] })
      .notNull()
      .default("file"),
    width: integer("width"),
    height: integer("height"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    attachedAt: timestamp("attached_at", { mode: "date" }),
  },
  (table) => [
    index("asset_workspaceId_idx").on(table.workspaceId),
    index("asset_createdBy_idx").on(table.createdBy),
    index("asset_taskId_idx").on(table.taskId),
    index("asset_taskId_source_idx").on(table.taskId, table.sourceAssetId),
    index("asset_draft_expiry_idx")
      .on(table.createdAt, table.id)
      .where(sql`${table.attachedAt} is null`),
    check(
      "asset_attached_has_container",
      sql`${table.attachedAt} is null or ${table.taskId} is not null`,
    ),
  ],
);
