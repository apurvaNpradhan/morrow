import { taskAttachmentCollection } from "../collections/task-attachment-collection";

/** Deletes a file of a task. It disappears at once and returns when the server has confirmed it. */
export async function removeAttachment(assetId: string) {
  await taskAttachmentCollection.delete(assetId).isPersisted.promise;
}
