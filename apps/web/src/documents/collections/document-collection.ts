import { documentsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * The page tree of every Workspace the user belongs to: titles, icons and
 * where each page sits. A page's content is not here (it is a Yjs document),
 * and typing does not change these rows. The browser picks a new page's id
 * and position, so it shows before the server answers.
 */
export const documentCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      documentsShape,
      electricCollectionOptions({
        id: documentsShape.name,
        schema: documentsShape.schema,
        getKey: (row) => row.id,
        defaultIndexType: BasicIndex,
        autoIndex: "eager",
        shapeOptions: shapeOptions(documentsShape.name),
        onInsert: async ({ transaction, collection }) => {
          const { modified } = transaction.mutations[0];
          const { txid } = await rpc.documents.create({
            workspaceId: modified.workspaceId,
            id: modified.id,
            projectId: modified.projectId,
            parentId: modified.parentId,
            position: modified.position,
            title: modified.title,
            ...(modified.icon !== null && { icon: modified.icon }),
          });
          await collection.utils.awaitTxId(txid);
        },
        onUpdate: async ({ transaction, collection }) => {
          const { original, changes } = transaction.mutations[0];
          const target = {
            workspaceId: original.workspaceId,
            documentId: original.id,
          };
          if (changes.title !== undefined || changes.icon !== undefined) {
            const { txid } = await rpc.documents.update({
              ...target,
              ...(changes.title !== undefined && { title: changes.title }),
              ...(changes.icon !== undefined && { icon: changes.icon }),
            });
            await collection.utils.awaitTxId(txid);
          }
          if (
            changes.parentId !== undefined ||
            changes.projectId !== undefined ||
            changes.position !== undefined
          ) {
            const { txid } = await rpc.documents.move({
              ...target,
              parentId:
                changes.parentId !== undefined
                  ? changes.parentId
                  : original.parentId,
              projectId:
                changes.projectId !== undefined
                  ? changes.projectId
                  : original.projectId,
              position: changes.position ?? original.position,
            });
            await collection.utils.awaitTxId(txid);
          }
          if (changes.archivedAt !== undefined) {
            const archive =
              changes.archivedAt === null
                ? rpc.documents.restore
                : rpc.documents.archive;
            const { txid } = await archive(target);
            await collection.utils.awaitTxId(txid);
          }
        },
        onDelete: async ({ transaction, collection }) => {
          const { original } = transaction.mutations[0];
          const { txid } = await rpc.documents.delete({
            workspaceId: original.workspaceId,
            documentId: original.id,
          });
          await collection.utils.awaitTxId(txid);
        },
      }),
    ),
  ),
);
