import { workspacesShape } from "@morrow/sync-schemas";
import { workspaceTable } from "#api/platform/database/schema";
import { defineShape } from "#api/platform/sync/define-shape";

/** The Workspaces the user belongs to. `metadata` is Better Auth's and never leaves. */
const workspaces = defineShape({
  shape: workspacesShape,
  table: workspaceTable,
  where: ({ userId }) => ({
    sql: "id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

export const workspaceShapes = [workspaces];
