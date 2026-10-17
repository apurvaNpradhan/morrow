import {
  taskCommentsShape,
  taskDescriptionsShape,
  taskEventsShape,
  tasksShape,
} from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskEventTable,
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

export const tasksShapes = [tasks, taskDescriptions, taskComments, taskEvents];
