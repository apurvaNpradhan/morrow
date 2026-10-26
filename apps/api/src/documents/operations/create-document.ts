import { DOCUMENT_ID_PATTERN } from "@morrow/sync-schemas";
import { withTxid } from "#api/platform/sync/with-txid";
import { assertValidPosition } from "#api/projects/index";
import { documentError, rethrowDocumentViolation } from "../errors";
import { emptyDocument } from "../lib/empty-document";
import {
  assertProjectWritable,
  lockDocument,
  lockTree,
} from "../lib/tree-lock";
import { createPageStream } from "../lib/yjs-streams";
import { yjsServerUrl } from "../lib/yjs-server";
import { documentClientTable, documentTable } from "../tables";

export type NewDocument = {
  id: string;
  projectId: string | null;
  parentId: string | null;
  position: string;
  title?: string;
  icon?: string;
};

/**
 * Adds a page at the position the client chose, under a page or at the top of
 * a Project (or of the Workspace root), and creates its stream holding an
 * empty document. The id and position come from the browser so the page can
 * appear before the server answers. The stream is written in the transaction,
 * so a page whose stream could not be created is not left behind.
 */
export async function createDocument(
  workspaceId: string,
  userId: string,
  input: NewDocument,
) {
  if (!DOCUMENT_ID_PATTERN.test(input.id)) {
    throw documentError("INVALID_DOCUMENT_ID");
  }
  assertValidPosition(input.position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockTree(tx, workspaceId);
      if (input.parentId !== null) {
        const parent = await lockDocument(tx, workspaceId, input.parentId);
        if (parent.projectId !== input.projectId) {
          throw documentError("PARENT_NOT_IN_PROJECT");
        }
      }
      await assertProjectWritable(tx, workspaceId, input.projectId);
      await tx.insert(documentTable).values({
        id: input.id,
        workspaceId,
        projectId: input.projectId,
        parentId: input.parentId,
        position: input.position,
        title: input.title ?? "",
        icon: input.icon ?? null,
        createdBy: userId,
      });
      const { update, clientId } = emptyDocument();
      await tx.insert(documentClientTable).values({
        documentId: input.id,
        yjsClientId: clientId,
        userId,
        via: "system",
      });
      await createPageStream(
        yjsServerUrl(),
        { docId: input.id, generation: 1 },
        update,
      );
    });
    return { id: input.id, txid };
  } catch (error) {
    rethrowDocumentViolation(error);
  }
}
