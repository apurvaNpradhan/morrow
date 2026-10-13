import { z } from "zod";
import { defineQueue } from "#api/platform/jobs/define-queue";
import {
  removeUnreferencedObject,
  withStorageObject,
} from "./assets/unreferenced-object";

/** Deletes one stored object that nothing references any more. */
export const deleteObjectQueue = defineQueue({
  name: "storage.delete-object",
  schema: z.object({ objectKey: z.string() }),
  dedupe: true,
  retryLimit: 10,
  expireInSeconds: 60,
  // Object keys can embed user-chosen paths, so failures log no payload field.
  handler: ({ objectKey }) =>
    withStorageObject(objectKey, (tx) =>
      removeUnreferencedObject(tx, objectKey),
    ),
});

export const storageQueues = [deleteObjectQueue];
