import { taskCommentsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { workspaceOf } from "./task-writes";

/**
 * Comments, loaded one task at a time when a task is opened: reads are live
 * queries with a `where` on the task id. A comment is posted, edited and
 * deleted here, so it appears before the server answers.
 */
export const taskCommentCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskCommentsShape.name,
      schema: taskCommentsShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskCommentsShape.name),
      onInsert: async ({ transaction, collection }) => {
        const { modified } = transaction.mutations[0];
        const { txid } = await rpc.comments.create({
          workspaceId: workspaceOf(modified.projectId),
          projectId: modified.projectId,
          taskId: modified.taskId,
          id: modified.id,
          body: modified.body,
        });
        await collection.utils.awaitTxId(txid);
      },
      onUpdate: async ({ transaction, collection }) => {
        const { original, changes } = transaction.mutations[0];
        if (changes.body === undefined) return;
        const { txid } = await rpc.comments.update({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          taskId: original.taskId,
          commentId: original.id,
          body: changes.body,
        });
        await collection.utils.awaitTxId(txid);
      },
      onDelete: async ({ transaction, collection }) => {
        const { original } = transaction.mutations[0];
        const { txid } = await rpc.comments.delete({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          taskId: original.taskId,
          commentId: original.id,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
