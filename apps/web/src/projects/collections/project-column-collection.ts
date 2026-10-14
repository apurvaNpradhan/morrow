import { projectColumnsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { projectCollection } from "./project-collection";

/** What a column delete needs besides the column: where its items go. */
export type DeleteColumnMetadata = { targetColumnId: string };

/** The workspace a project belongs to; every column write names it. */
function workspaceOf(projectId: string) {
  const project = projectCollection.get(projectId);
  if (!project) throw new Error("Project is not loaded");
  return project.workspaceId;
}

/**
 * Columns of every project the user can see. Adding one is not an insert here
 * (the server picks its position); renames, colour, moves and deletes are.
 */
export const projectColumnCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: projectColumnsShape.name,
      schema: projectColumnsShape.schema,
      getKey: (row) => row.id,
      defaultIndexType: BasicIndex,
      autoIndex: "eager",
      shapeOptions: shapeOptions(projectColumnsShape.name),
      onUpdate: async ({ transaction, collection }) => {
        const { original, changes } = transaction.mutations[0];
        const target = {
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          columnId: original.id,
        };

        if (changes.name !== undefined || changes.color !== undefined) {
          const { txid } = await rpc.projects.columns.update({
            ...target,
            ...(changes.name !== undefined && { name: changes.name }),
            ...(changes.color !== undefined && { color: changes.color }),
          });
          await collection.utils.awaitTxId(txid);
        }
        if (changes.category !== undefined || changes.position !== undefined) {
          const { txid } = await rpc.projects.columns.move({
            ...target,
            category: changes.category ?? original.category,
            position: changes.position ?? original.position,
          });
          await collection.utils.awaitTxId(txid);
        }
      },
      onDelete: async ({ transaction, collection }) => {
        const { original, metadata } = transaction.mutations[0];
        const { targetColumnId } = metadata as DeleteColumnMetadata;
        const { txid } = await rpc.projects.columns.remove({
          workspaceId: workspaceOf(original.projectId),
          projectId: original.projectId,
          columnId: original.id,
          targetColumnId,
        });
        await collection.utils.awaitTxId(txid);
      },
    }),
  ),
);
