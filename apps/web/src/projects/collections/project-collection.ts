import { type ColumnColor, projectsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Projects of every Workspace the user belongs to, archived ones included.
 * Pages filter by Workspace and by `archivedAt`. Creating a project is not an
 * insert here (the server picks its id, position and columns); delete is.
 */
export const projectCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      projectsShape,
      electricCollectionOptions({
        id: projectsShape.name,
        schema: projectsShape.schema,
        getKey: (row) => row.id,
        defaultIndexType: BasicIndex,
        autoIndex: "eager",
        shapeOptions: shapeOptions(projectsShape.name),
        // One edit can touch several fields; each field has its own Procedure,
        // and each answers with the transaction id to wait for.
        onUpdate: async ({ transaction, collection }) => {
          const { original, changes } = transaction.mutations[0];
          const target = {
            workspaceId: original.workspaceId,
            projectId: original.id,
          };
          const waitFor = async (result: { txid: number | null }) => {
            if (result.txid !== null) {
              await collection.utils.awaitTxId(result.txid);
            }
          };

          if (changes.key !== undefined) {
            await waitFor(
              await rpc.projects.changeKey({ ...target, key: changes.key }),
            );
          }
          if (
            changes.name !== undefined ||
            changes.description !== undefined ||
            changes.icon !== undefined ||
            changes.color !== undefined
          ) {
            await waitFor(
              await rpc.projects.update({
                ...target,
                ...(changes.name !== undefined && { name: changes.name }),
                ...(changes.description !== undefined && {
                  description: changes.description ?? "",
                }),
                ...(changes.icon !== undefined && {
                  icon: changes.icon,
                }),
                ...(changes.color !== undefined && {
                  color: changes.color as ColumnColor | null,
                }),
              }),
            );
          }
          if (changes.position !== undefined) {
            await waitFor(
              await rpc.projects.reorder({
                ...target,
                position: changes.position,
              }),
            );
          }
          if (changes.archivedAt !== undefined) {
            await waitFor(
              changes.archivedAt
                ? await rpc.projects.archive(target)
                : await rpc.projects.unarchive(target),
            );
          }
        },
        onDelete: async ({ transaction, collection }) => {
          const { original } = transaction.mutations[0];
          const { txid } = await rpc.projects.remove({
            workspaceId: original.workspaceId,
            projectId: original.id,
          });
          await collection.utils.awaitTxId(txid);
        },
      }),
    ),
  ),
);
