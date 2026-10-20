import {
  taskCommentsShape,
  taskAttachmentsShape,
  taskDescriptionsShape,
  taskEventsShape,
  taskLinksShape,
  taskRelationsShape,
  tasksShape,
} from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { assetTable } from "#api/storage/index";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskEventTable,
  taskLinkTable,
  taskRelationTable,
  taskTable,
} from "./tables";

/**
 * Every task of the Projects of every Workspace the user belongs to, archived
 * ones included: membership implies read, so no permission logic is needed.
 * The browser may narrow it with subset queries, never widen it.
 */
const tasks = defineShape({
  shape: tasksShape,
  table: taskTable,
  where: ({ userId }) => ({
    sql: "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

/**
 * The descriptions of those tasks, read one task at a time when it is opened;
 * scoped the same way, through the Project the row repeats.
 */
const taskDescriptions = defineShape({
  shape: taskDescriptionsShape,
  table: taskDescriptionTable,
  where: ({ userId }) => ({
    sql: "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

/**
 * The comments of those tasks, read one task at a time when it is opened;
 * scoped the same way, through the Project the row repeats.
 */
const taskComments = defineShape({
  shape: taskCommentsShape,
  table: taskCommentTable,
  where: ({ userId }) => ({
    sql: "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

/**
 * The history of those tasks, read one task at a time when it is opened;
 * scoped the same way. Read-only: only the Procedures write it.
 */
const taskEvents = defineShape({
  shape: taskEventsShape,
  table: taskEventTable,
  where: ({ userId }) => ({
    sql: "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

/**
 * The external links of those tasks, read one task at a time when it is
 * opened; scoped the same way.
 */
const taskLinks = defineShape({
  shape: taskLinksShape,
  table: taskLinkTable,
  where: ({ userId }) => ({
    sql: "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

/**
 * The relations of the Workspaces the user belongs to, read with a `where` on
 * the Task they concern; scoped by membership through the Workspace the row
 * repeats.
 */
const taskRelations = defineShape({
  shape: taskRelationsShape,
  table: taskRelationTable,
  where: ({ userId }) => ({
    sql: "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

/**
 * The files attached to tasks of the Workspaces the user belongs to, read one
 * task at a time when it is opened. Drafts are left out: they are private to
 * their uploader.
 */
const taskAttachments = defineShape({
  shape: taskAttachmentsShape,
  table: assetTable,
  where: ({ userId }) => ({
    sql: "attached_at IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

export const tasksShapes = [
  tasks,
  taskDescriptions,
  taskComments,
  taskEvents,
  taskLinks,
  taskRelations,
  taskAttachments,
];
