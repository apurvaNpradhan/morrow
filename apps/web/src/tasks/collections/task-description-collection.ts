import { taskDescriptionsShape } from "@morrow/sync-schemas";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { shapeOptions } from "@/app/sync/shape-options";
import { registerSyncedCollection } from "@/app/sync/synced-collections";

/**
 * Task descriptions, loaded one task at a time when a task is opened: the list
 * never downloads text it does not show. Reads are live queries with a
 * `where` on the task id. Edits go through `useDescriptionAutosave`, which
 * writes with its own transaction, so the collection has no write handlers.
 */
export const taskDescriptionCollection = registerSyncedCollection(
  createCollection(
    electricCollectionOptions({
      id: taskDescriptionsShape.name,
      schema: taskDescriptionsShape.schema,
      getKey: (row) => row.taskId,
      syncMode: "on-demand",
      shapeOptions: shapeOptions(taskDescriptionsShape.name),
    }),
  ),
);
