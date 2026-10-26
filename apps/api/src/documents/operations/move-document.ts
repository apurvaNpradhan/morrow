import { inArray } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { assertValidPosition } from "#api/projects/index";
import { documentError } from "../errors";
import { isInSubtree, subtreeIds } from "../lib/subtree";
import {
  assertProjectWritable,
  lockDocument,
  lockTree,
} from "../lib/tree-lock";
import { documentTable } from "../tables";

/**
 * Moves a page, with everything under it, under another page, to the top of a
 * Project or to the Workspace root, at a position the client computed. The
 * whole subtree takes the target's Project. A page cannot move into its own
 * subtree, into an archived page or into an archived Project.
 */
export async function moveDocument(
  workspaceId: string,
  documentId: string,
  target: {
    parentId: string | null;
    projectId: string | null;
    position: string;
  },
) {
  assertValidPosition(target.position);
  const { txid } = await withTxid(async (tx) => {
    await lockTree(tx, workspaceId);
    const document = await lockDocument(tx, workspaceId, documentId);
    await assertProjectWritable(tx, workspaceId, document.projectId);

    if (target.parentId !== null) {
      if (await isInSubtree(tx, documentId, target.parentId)) {
        throw documentError("DOCUMENT_CYCLE");
      }
      const parent = await lockDocument(tx, workspaceId, target.parentId);
      if (parent.projectId !== target.projectId) {
        throw documentError("PARENT_NOT_IN_PROJECT");
      }
    }
    await assertProjectWritable(tx, workspaceId, target.projectId);

    const ids = await subtreeIds(tx, documentId);
    await tx
      .update(documentTable)
      .set({ projectId: target.projectId })
      .where(inArray(documentTable.id, ids));
    await tx
      .update(documentTable)
      .set({ parentId: target.parentId, position: target.position })
      .where(eq(documentTable.id, documentId));
  });
  return { txid };
}
