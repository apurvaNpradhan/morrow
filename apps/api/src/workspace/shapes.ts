import { workspacesShape } from "@morrow/sync-schemas";
import { workspaceTable } from "#api/platform/database/schema";
import { defineShape } from "#api/platform/sync/define-shape";

/**
 * The Workspaces the user belongs to, and those that invited them (so an
 * invitation can show where it leads). The web app lists only the ones the
 * user is a member of. `metadata` is Better Auth's and never leaves.
 */
const workspaces = defineShape({
  shape: workspacesShape,
  table: workspaceTable,
  where: ({ userId, verifiedEmail }) => ({
    sql: "id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1) OR id IN (SELECT workspace_id FROM invitation WHERE status = 'pending' AND lower(email) = lower($2))",
    params: [userId, verifiedEmail],
  }),
});

export const workspaceShapes = [workspaces];
