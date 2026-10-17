import { taskEventsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * A task's history, loaded one task at a time when it is opened: reads are
 * live queries with a `where` on the task id. Only the API writes it, so the
 * collection has no write handlers.
 */
export const taskEventCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskEventsShape.name,
      schema: taskEventsShape.schema,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskEventsShape.name),
    }),
  ),
);
