import { taskAttachmentsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { taskCollection } from "./task-collection";

/**
 * The files attached to tasks, loaded one task at a time when a task is
 * opened: reads are live queries with a `where` on the task id. Files are
 * added through the editor's uploads, never here; a file is only deleted here,
 * so it disappears at once.
 */
export const taskAttachmentCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskAttachmentsShape.name,
      schema: taskAttachmentsShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskAttachmentsShape.name),
      onDelete: async ({ transaction, collection }) => {
        const { original } = transaction.mutations[0];
        const task = taskCollection.get(original.taskId);
        if (!task) throw new Error("Task is not loaded");
        const { txid } = await rpc.tasks.deleteAttachment({
          workspaceId: original.workspaceId,
          projectId: task.projectId,
          taskId: original.taskId,
          assetId: original.id,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
