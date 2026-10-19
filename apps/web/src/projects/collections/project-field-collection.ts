import { projectFieldsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";
import { projectCollection } from "./project-collection";

/** The workspace a project belongs to; every field write names it. */
function workspaceOf(projectId: string) {
  const project = projectCollection.get(projectId);
  if (!project) throw new Error("Project is not loaded");
  return project.workspaceId;
}

/**
 * Custom Fields of every project the user can see, with their options. Adding a
 * Field is not an insert here (the server assigns the id and position), and
 * option edits go through their own Procedures (see the field actions);
 * renames, moves and deletes of a Field are.
 */
export const projectFieldCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      projectFieldsShape,
      electricCollectionOptions({
        id: projectFieldsShape.name,
        schema: projectFieldsShape.schema,
        getKey: (row) => row.id,
        defaultIndexType: BasicIndex,
        autoIndex: "eager",
        shapeOptions: shapeOptions(projectFieldsShape.name),
        onUpdate: async ({ transaction, collection }) => {
          const { original, changes } = transaction.mutations[0];
          const target = {
            workspaceId: workspaceOf(original.projectId),
            projectId: original.projectId,
            fieldId: original.id,
          };
          if (changes.name !== undefined) {
            const { txid } = await rpc.projects.fields.update({
              ...target,
              name: changes.name,
            });
            await collection.utils.awaitTxId(txid);
          }
          if (changes.position !== undefined) {
            const { txid } = await rpc.projects.fields.move({
              ...target,
              position: changes.position,
            });
            await collection.utils.awaitTxId(txid);
          }
        },
        onDelete: async ({ transaction, collection }) => {
          const { original } = transaction.mutations[0];
          const { txid } = await rpc.projects.fields.remove({
            workspaceId: workspaceOf(original.projectId),
            projectId: original.projectId,
            fieldId: original.id,
          });
          await collection.utils.awaitTxId(txid);
        },
      }),
    ),
  ),
);
