import { labelsShape } from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { labelTable } from "./tables";

/**
 * The Labels of every Workspace the user belongs to: membership implies read,
 * so no permission logic is needed.
 */
const labels = defineShape({
  shape: labelsShape,
  table: labelTable,
  where: ({ userId }) => ({
    sql: "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

export const labelsShapes = [labels];
