import { workspaceMemberUsersShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { persistedShape } from "@/app/sync/persisted-shape";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/** The people behind the members of every Workspace the user belongs to. */
export const workspaceMemberUserCollection = registerSyncedCollection(
  createCollection(
    persistedShape(
      workspaceMemberUsersShape,
      electricCollectionOptions({
        id: workspaceMemberUsersShape.name,
        schema: workspaceMemberUsersShape.schema,
        getKey: (row) => row.id,
        shapeOptions: shapeOptions(workspaceMemberUsersShape.name),
      }),
    ),
  ),
);
