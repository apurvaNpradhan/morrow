import { createId } from "@paralleldrive/cuid2";
import type { DocumentRow } from "@morrow/sync-schemas";
import { documentCollection } from "../collections/document-collection";
import {
  type MoveTarget,
  indexPages,
  positionAtEnd,
  type TreeScope,
} from "../lib/document-tree";

/*
 * The writes components make. Each changes the local collection at once and
 * resolves when the change has come back through sync; if the server refuses
 * it the collection rolls back and the promise rejects.
 */

/** Adds an empty page at the end of `parentId`'s children; resolves with it once synced. */
export async function createDocument(input: {
  workspaceId: string;
  projectId: string | null;
  parentId: string | null;
  title?: string;
}): Promise<DocumentRow> {
  const scope: TreeScope = { projectId: input.projectId };
  const index = indexPages(
    documentCollection.toArray.filter(
      (row) => row.workspaceId === input.workspaceId,
    ),
  );
  const now = new Date();
  const id = createId();
  const transaction = documentCollection.insert({
    id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    parentId: input.parentId,
    position: positionAtEnd(index, input.parentId, scope),
    title: input.title ?? "",
    icon: null,
    generation: 1,
    overLimit: false,
    archivedAt: null,
    archivedRootId: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  });
  await transaction.isPersisted.promise;
  const created = documentCollection.get(id);
  if (!created) throw new Error("The created page did not sync");
  return created;
}

/** Renames a page or changes its icon; resolves when the change has synced back. */
export async function updateDocument(
  documentId: string,
  patch: { title?: string; icon?: string | null },
) {
  const transaction = documentCollection.update(documentId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/** Moves a page, with its subtree, to where a drop put it. */
export async function moveDocument(documentId: string, target: MoveTarget) {
  const transaction = documentCollection.update(documentId, (draft) => {
    draft.parentId = target.parentId;
    draft.projectId = target.projectId;
    draft.position = target.position;
  });
  await transaction.isPersisted.promise;
}

/** Hides a page and its subtree and makes them read-only. */
export async function archiveDocument(documentId: string) {
  const transaction = documentCollection.update(documentId, (draft) => {
    draft.archivedAt = new Date();
  });
  await transaction.isPersisted.promise;
}

/** Brings back an archived page and the descendants archived with it. */
export async function restoreDocument(documentId: string) {
  const transaction = documentCollection.update(documentId, (draft) => {
    draft.archivedAt = null;
  });
  await transaction.isPersisted.promise;
}

/** Deletes a page for good; its children move up to its parent. */
export async function deleteDocument(documentId: string) {
  await documentCollection.delete(documentId).isPersisted.promise;
}
