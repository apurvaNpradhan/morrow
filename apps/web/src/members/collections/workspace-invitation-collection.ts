import { workspaceInvitationsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Pending invitations of every Workspace the user belongs to. Only pending
 * rows sync, so an accepted or cancelled invitation leaves as a delete.
 */
export const workspaceInvitationCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      workspaceInvitationsShape,
      electricCollectionOptions({
        id: workspaceInvitationsShape.name,
        schema: workspaceInvitationsShape.schema,
        getKey: (row) => row.id,
        shapeOptions: shapeOptions(workspaceInvitationsShape.name),
      }),
    ),
  ),
);
