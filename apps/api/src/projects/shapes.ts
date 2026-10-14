import { projectColumnsShape, projectsShape } from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { projectColumnTable, projectTable } from "./tables";

/**
 * Both shapes cover every Workspace the user belongs to, like the members
 * shapes: membership implies read, so no permission logic is needed. Archived
 * projects sync too, so the archive list is live; the web app hides them.
 */

const MEMBER_WORKSPACES =
  "SELECT workspace_id FROM workspace_member WHERE user_id = $1";

/** Projects of every Workspace the user belongs to. */
const projects = defineShape({
  shape: projectsShape,
  table: projectTable,
  where: ({ userId }) => ({
    sql: `workspace_id IN (${MEMBER_WORKSPACES})`,
    params: [userId],
  }),
});

/** The Columns of those Projects. */
const projectColumns = defineShape({
  shape: projectColumnsShape,
  table: projectColumnTable,
  where: ({ userId }) => ({
    sql: `project_id IN (SELECT id FROM project WHERE workspace_id IN (${MEMBER_WORKSPACES}))`,
    params: [userId],
  }),
});

export const projectsShapes = [projects, projectColumns];
