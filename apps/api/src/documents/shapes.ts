import { documentsShape } from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import { documentTable } from "./tables";

/**
 * The page tree of every Workspace the user belongs to: membership implies
 * read, so no permission logic is needed. Archived pages are sent too (they are
 * hidden by the tree, not removed). Content is not a shape; it is a Yjs
 * document on Durable Streams.
 */
const documents = defineShape({
  shape: documentsShape,
  table: documentTable,
  where: ({ userId }) => ({
    sql: "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

export const documentsShapes = [documents];
