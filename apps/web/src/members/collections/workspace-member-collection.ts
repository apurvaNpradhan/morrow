import { workspaceMembersShape } from "@morrow/sync-schemas";
import {
  electricCollectionOptions,
  isChangeMessage,
} from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/** Members of every Workspace the user belongs to. Pages filter by Workspace. */
export const workspaceMemberCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: workspaceMembersShape.name,
      schema: workspaceMembersShape.schema,
      getKey: (row) => row.id,
      shapeOptions: shapeOptions(workspaceMembersShape.name),
      // Better Auth performs the role change, so there is no transaction id to
      // wait for: wait for the changed row to come back through sync instead.
      onUpdate: async ({ transaction, collection }) => {
        const { original, changes } = transaction.mutations[0];
        if (changes.role === undefined) return;
        const { role } = changes;
        await rpc.members.updateRole({
          workspaceId: original.workspaceId,
          memberId: original.id,
          role,
        });
        await collection.utils.awaitMatch(
          (message) =>
            isChangeMessage(message) &&
            message.headers.operation === "update" &&
            message.value.id === original.id &&
            message.value.role === role,
          5_000,
        );
      },
    }),
  ),
);
