import { taskDescriptionsShape, tasksShape } from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { taskDescriptionTable, taskTable } from "./tables";

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

export const tasksShapes = [tasks, taskDescriptions];
