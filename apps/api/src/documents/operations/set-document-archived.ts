import { and, eq, inArray, isNull } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { documentError } from "../errors";
import { subtreeIds } from "../lib/subtree";
import {
  assertProjectWritable,
  lockDocument,
  lockTree,
} from "../lib/tree-lock";
import { documentTable } from "../tables";

/**
 * Archives a page and everything under it in one transaction that holds their
 * locks. Pages in the subtree that an earlier archive already hid keep that
 * archive, so restoring this page does not bring them back.
 */
export async function archiveDocument(workspaceId: string, documentId: string) {
  const { txid } = await withTxid(async (tx) => {
    await lockTree(tx, workspaceId);
    const document = await lockDocument(tx, workspaceId, documentId);
    await assertProjectWritable(tx, workspaceId, document.projectId);
    const ids = await subtreeIds(tx, documentId);
    await tx
      .update(documentTable)
      .set({ archivedAt: new Date(), archivedRootId: documentId })
      .where(
        and(inArray(documentTable.id, ids), isNull(documentTable.archivedAt)),
      );
  });
  return { txid };
}

/**
 * Restores a page archived on its own, with the pages that archive hid. A page
 * hidden by an ancestor's archive comes back with that ancestor.
 */
export async function restoreDocument(workspaceId: string, documentId: string) {
  const { txid } = await withTxid(async (tx) => {
    await lockTree(tx, workspaceId);
    const document = await lockDocument(tx, workspaceId, documentId, {
      allowArchived: true,
    });
    if (!document.archivedAt) throw documentError("DOCUMENT_NOT_ARCHIVED");
    if (document.archivedRootId !== documentId) {
      throw documentError("DOCUMENT_ARCHIVED_WITH_ANCESTOR");
    }
    await assertProjectWritable(tx, workspaceId, document.projectId);
    if (document.parentId !== null) {
      const parent = await lockDocument(tx, workspaceId, document.parentId, {
        allowArchived: true,
      });
      if (parent.archivedAt) throw documentError("DOCUMENT_PARENT_ARCHIVED");
    }
    await tx
      .update(documentTable)
      .set({ archivedAt: null, archivedRootId: null })
      .where(eq(documentTable.archivedRootId, documentId));
  });
  return { txid };
}
