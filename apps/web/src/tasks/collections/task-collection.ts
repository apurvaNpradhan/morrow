import { tasksShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BTreeIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { workspaceOf, writeTaskChanges } from "./task-writes";

/**
 * Tasks of every Project the user can see, loaded on demand: each live query's
 * `where` becomes a subset request, so a board loads only its Project's tasks.
 * Changes made anywhere still arrive through the change stream. Reads are
 * always live queries with a `where`; nothing reads this collection whole.
 */
export const taskCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: tasksShape.name,
      schema: tasksShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      // A B-tree takes a row in O(log n); the sorted array of the basic index
      // is spliced per distinct value, which is most rows for `number` and
      // `archivedAt`.
      defaultIndexType: BTreeIndex,
      autoIndex: "eager",
      shapeOptions: shapeOptions(tasksShape.name),
      onInsert: async ({ transaction, collection }) => {
        const { modified, metadata } = transaction.mutations[0];
        const target = {
          workspaceId: workspaceOf(modified.projectId),
          projectId: modified.projectId,
          id: modified.id,
          position: modified.position,
        };
        const { duplicateOf, description } = (metadata ?? {}) as {
          duplicateOf?: string;
          description?: string;
        };
        const { txid } = duplicateOf
          ? await rpc.tasks.duplicate({ ...target, taskId: duplicateOf })
          : await rpc.tasks.create({
              ...target,
              columnId: modified.columnId,
              title: modified.title,
              description,
              priority: modified.priority,
              assigneeId: modified.assigneeId,
              dueDate: modified.dueDate,
              labelIds: modified.labelIds,
              parentId: modified.parentId,
              fieldValues: modified.fieldValues,
            });
        await collection.utils.awaitTxId(txid);
      },
      onUpdate: async ({ transaction, collection }) => {
        for (const mutation of transaction.mutations) {
          for (const txid of await writeTaskChanges(mutation)) {
            await collection.utils.awaitTxId(txid);
          }
        }
      },
      onDelete: async ({ transaction, collection }) => {
        const { original } = transaction.mutations[0];
        const { txid } = await rpc.tasks.remove({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          taskId: original.id,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
