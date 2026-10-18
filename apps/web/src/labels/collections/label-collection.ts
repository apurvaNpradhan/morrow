import { labelsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Labels of every Workspace the user belongs to. A label is added, renamed,
 * recoloured, moved and deleted here: the browser picks the id and position,
 * so a new label shows before the server answers.
 */
export const labelCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      labelsShape,
      electricCollectionOptions({
        id: labelsShape.name,
        schema: labelsShape.schema,
        getKey: (row) => row.id,
        defaultIndexType: BasicIndex,
        autoIndex: "eager",
        shapeOptions: shapeOptions(labelsShape.name),
        onInsert: async ({ transaction, collection }) => {
          const { modified } = transaction.mutations[0];
          const { txid } = await rpc.labels.create({
            workspaceId: modified.workspaceId,
            id: modified.id,
            name: modified.name,
            color: modified.color,
            position: modified.position,
          });
          await collection.utils.awaitTxId(txid);
        },
        onUpdate: async ({ transaction, collection }) => {
          const { original, changes } = transaction.mutations[0];
          const target = {
            workspaceId: original.workspaceId,
            labelId: original.id,
          };
          if (changes.name !== undefined || changes.color !== undefined) {
            const { txid } = await rpc.labels.update({
              ...target,
              ...(changes.name !== undefined && { name: changes.name }),
              ...(changes.color !== undefined && { color: changes.color }),
            });
            await collection.utils.awaitTxId(txid);
          }
          if (changes.position !== undefined) {
            const { txid } = await rpc.labels.move({
              ...target,
              position: changes.position,
            });
            await collection.utils.awaitTxId(txid);
          }
        },
        onDelete: async ({ transaction, collection }) => {
          const { original } = transaction.mutations[0];
          const { txid } = await rpc.labels.delete({
            workspaceId: original.workspaceId,
            labelId: original.id,
          });
          await collection.utils.awaitTxId(txid);
        },
      }),
    ),
  ),
);
