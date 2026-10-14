import { workspacesShape } from "@morrow/sync-schemas";
import {
  electricCollectionOptions,
  isChangeMessage,
} from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Workspaces the user belongs to, plus those with a pending invitation for
 * them (so an invitation can name where it leads). Read the user's own through
 * `useMyWorkspaces`, which keeps only the ones they are a member of.
 */
export const workspaceCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: workspacesShape.name,
      schema: workspacesShape.schema,
      getKey: (row) => row.id,
      shapeOptions: shapeOptions(workspacesShape.name),
      // Better Auth performs the update, so wait for the changed row to come
      // back through sync instead of a transaction id.
      onUpdate: async ({ transaction, collection }) => {
        const { original, changes } = transaction.mutations[0];
        const { name, description } = changes;
        await rpc.workspace.update({
          workspaceId: original.id,
          ...(name !== undefined && { name }),
          ...(description !== undefined && {
            description: description ?? "",
          }),
        });
        await collection.utils.awaitMatch(
          (message) =>
            isChangeMessage(message) &&
            message.headers.operation === "update" &&
            message.value.id === original.id &&
            (name === undefined || message.value.name === name) &&
            (description === undefined ||
              message.value.description === (description ?? "")),
          5_000,
        );
      },
    }),
  ),
);
