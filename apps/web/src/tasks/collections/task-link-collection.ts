import { taskLinksShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { workspaceOf } from "./task-writes";

/**
 * External links, loaded one task at a time when a task is opened: reads are
 * live queries with a `where` on the task id. A link is added, edited and
 * removed here, so it appears before the server answers.
 */
export const taskLinkCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskLinksShape.name,
      schema: taskLinksShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskLinksShape.name),
      onInsert: async ({ transaction, collection }) => {
        const { modified } = transaction.mutations[0];
        const { txid } = await rpc.links.add({
          workspaceId: workspaceOf(modified.projectId),
          projectId: modified.projectId,
          taskId: modified.taskId,
          id: modified.id,
          url: modified.url,
          title: modified.title ?? undefined,
        });
        // A URL the task already had writes nothing, so there is nothing to wait for.
        if (txid !== null) await collection.utils.awaitTxId(txid);
      },
      onUpdate: async ({ transaction, collection }) => {
        const { original, changes } = transaction.mutations[0];
        const { txid } = await rpc.links.update({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          taskId: original.taskId,
          linkId: original.id,
          url: changes.url,
          // An empty title clears it.
          title:
            changes.title === undefined ? undefined : (changes.title ?? ""),
        });
        await collection.utils.awaitTxId(txid);
      },
      onDelete: async ({ transaction, collection }) => {
        const { original } = transaction.mutations[0];
        const { txid } = await rpc.links.delete({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          taskId: original.taskId,
          linkId: original.id,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
