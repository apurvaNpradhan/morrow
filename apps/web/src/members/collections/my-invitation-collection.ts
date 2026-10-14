import { myInvitationsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/** Pending invitations addressed to the signed-in user's email. */
export const myInvitationCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: myInvitationsShape.name,
      schema: myInvitationsShape.schema,
      getKey: (row) => row.id,
      shapeOptions: shapeOptions(myInvitationsShape.name),
    }),
  ),
);
