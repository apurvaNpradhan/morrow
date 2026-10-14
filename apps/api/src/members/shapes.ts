import {
  userShapeSchema,
  workspaceMemberShapeSchema,
} from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";

/**
 * Both shapes are scoped to the user, not to one Workspace: they cover every
 * Workspace the user belongs to, so a join or removal reaches the browser
 * without a new request and switching Workspaces needs no new sync.
 */

/** Members of every Workspace the user belongs to. */
const workspaceMembers = defineShape({
  name: "workspace-members",
  table: workspaceUserTable,
  schema: workspaceMemberShapeSchema,
  where: ({ userId }) => ({
    sql: "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

/** The people behind those members: name, email and avatar, never tokens. */
const workspaceMemberUsers = defineShape({
  name: "workspace-member-users",
  table: userTable,
  schema: userShapeSchema,
  where: ({ userId }) => ({
    sql: "id IN (SELECT user_id FROM workspace_member WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    params: [userId],
  }),
});

export const membersShapes = [workspaceMembers, workspaceMemberUsers];
