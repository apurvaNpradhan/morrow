import { taskRelationsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Relations between Tasks, loaded for the Tasks a view shows: reads are live
 * queries with a `where` on the source or the target task id. A relation is
 * added and removed here, so it appears before the server answers. The server
 * puts a `related` pair in its stored order.
 */
export const taskRelationCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskRelationsShape.name,
      schema: taskRelationsShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskRelationsShape.name),
      onInsert: async ({ transaction, collection }) => {
        const { modified } = transaction.mutations[0];
        const { txid } = await rpc.relations.add({
          workspaceId: modified.workspaceId,
          id: modified.id,
          type: modified.type,
          sourceTaskId: modified.sourceTaskId,
          targetTaskId: modified.targetTaskId,
        });
        await collection.utils.awaitTxId(txid);
      },
      onDelete: async ({ transaction, collection }) => {
        const { original } = transaction.mutations[0];
        const { txid } = await rpc.relations.delete({
          workspaceId: original.workspaceId,
          relationId: original.id,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
