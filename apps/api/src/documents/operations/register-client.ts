import { and, eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { documentError, documentNotFound } from "../errors";
import { documentClientTable, documentTable } from "../tables";

/**
 * Records that a Yjs client id belongs to this user on this page, before the
 * editor's first write. Registering it again is fine; an id another user holds
 * is refused, and the editor then picks a new one. The write check refuses an
 * update whose client ids are not registered to its sender.
 */
export async function registerClient(
  workspaceId: string,
  userId: string,
  documentId: string,
  clientId: number,
) {
  const [document] = await db
    .select({ archivedAt: documentTable.archivedAt })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.id, documentId),
        eq(documentTable.workspaceId, workspaceId),
      ),
    );
  if (!document) throw documentNotFound();
  if (document.archivedAt) throw documentError("DOCUMENT_ARCHIVED");

  await db
    .insert(documentClientTable)
    .values({ documentId, yjsClientId: clientId, userId, via: "web" })
    .onConflictDoNothing();
  const [holder] = await db
    .select({ userId: documentClientTable.userId })
    .from(documentClientTable)
    .where(
      and(
        eq(documentClientTable.documentId, documentId),
        eq(documentClientTable.yjsClientId, clientId),
      ),
    );
  if (holder?.userId !== userId) throw documentError("CLIENT_ID_TAKEN");
}
