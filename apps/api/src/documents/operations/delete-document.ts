import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { logFailure } from "#api/platform/logger";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockDocument, lockTree } from "../lib/tree-lock";
import { deletePageStream } from "../lib/yjs-streams";
import { yjsServerUrl } from "../lib/yjs-server";
import { documentTable } from "../tables";

/**
 * Deletes a page for good. Its children move to its parent, between its
 * position and the next page's, keeping their order. The page's body, clients,
 * checkpoints and files go with the row; its stream is removed once the
 * transaction has committed (a stream that could not be removed is logged and
 * left, since nothing can reach it any more).
 */
export async function deleteDocument(workspaceId: string, documentId: string) {
  let generation = 1;
  const { txid } = await withTxid(async (tx) => {
    await lockTree(tx, workspaceId);
    const document = await lockDocument(tx, workspaceId, documentId, {
      allowArchived: true,
    });
    generation = document.generation;

    // Pages the deleted page's archive hid become archives of their own, so
    // each can still be restored.
    if (document.archivedRootId === documentId) {
      await tx.execute(sql`
        WITH RECURSIVE hidden AS (
          SELECT id, id AS top FROM documents
          WHERE parent_id = ${documentId} AND archived_root_id = ${documentId}
          UNION ALL
          SELECT child.id, hidden.top FROM documents child
          JOIN hidden ON child.parent_id = hidden.id
          WHERE child.archived_root_id = ${documentId}
        )
        UPDATE documents SET archived_root_id = hidden.top
        FROM hidden WHERE documents.id = hidden.id
      `);
    }

    const children = await tx
      .select({ id: documentTable.id })
      .from(documentTable)
      .where(eq(documentTable.parentId, documentId))
      .orderBy(asc(documentTable.position), asc(documentTable.id))
      .for("update");
    if (children.length > 0) {
      const sameLevel = and(
        eq(documentTable.workspaceId, workspaceId),
        document.parentId === null
          ? isNull(documentTable.parentId)
          : eq(documentTable.parentId, document.parentId),
        document.projectId === null
          ? isNull(documentTable.projectId)
          : eq(documentTable.projectId, document.projectId),
      );
      const [next] = await tx
        .select({ position: documentTable.position })
        .from(documentTable)
        .where(and(sameLevel, gt(documentTable.position, document.position)))
        .orderBy(asc(documentTable.position))
        .limit(1);
      const keys = generateNKeysBetween(
        document.position,
        next?.position ?? null,
        children.length,
      );
      for (const [index, child] of children.entries()) {
        await tx
          .update(documentTable)
          .set({ parentId: document.parentId, position: keys[index]! })
          .where(eq(documentTable.id, child.id));
      }
    }
    await tx.delete(documentTable).where(eq(documentTable.id, documentId));
  });

  try {
    await deletePageStream(yjsServerUrl(), { docId: documentId, generation });
  } catch (error) {
    logFailure("documents.delete-stream", { documentId }, error);
  }
  return { txid };
}
