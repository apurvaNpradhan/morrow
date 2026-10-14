import { userShapeSchema } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/** The people behind the members of every Workspace the user belongs to. */
export const workspaceMemberUserCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: "workspace-member-users",
      schema: userShapeSchema,
      getKey: (row) => row.id,
      shapeOptions: shapeOptions("workspace-member-users"),
    }),
  ),
);
