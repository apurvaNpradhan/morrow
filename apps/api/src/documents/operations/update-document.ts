import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { assertProjectWritable, lockDocument } from "../lib/tree-lock";
import { documentTable } from "../tables";

/** Renames a page or changes its icon; `icon: null` clears it. */
export async function updateDocument(
  workspaceId: string,
  documentId: string,
  patch: { title?: string; icon?: string | null },
) {
  const { txid } = await withTxid(async (tx) => {
    const document = await lockDocument(tx, workspaceId, documentId);
    await assertProjectWritable(tx, workspaceId, document.projectId);
    await tx
      .update(documentTable)
      .set({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.icon !== undefined && { icon: patch.icon }),
      })
      .where(eq(documentTable.id, documentId));
  });
  return { txid };
}
