import { createId } from "@paralleldrive/cuid2";
import type { TaskRow } from "@morrow/sync-schemas";
import { taskLinkCollection } from "../collections/task-link-collection";

/*
 * The writes the links section makes. Each shows at once and resolves when the
 * change has come back through sync; a refusal rolls it back and rejects.
 */

export async function addLink(
  task: Pick<TaskRow, "id" | "projectId">,
  link: { url: string; title: string | null },
) {
  const now = new Date();
  const transaction = taskLinkCollection.insert({
    id: createId(),
    taskId: task.id,
    projectId: task.projectId,
    url: link.url,
    title: link.title,
    createdAt: now,
    updatedAt: now,
  });
  await transaction.isPersisted.promise;
}

export async function editLink(
  linkId: string,
  link: { url: string; title: string | null },
) {
  const transaction = taskLinkCollection.update(linkId, (draft) => {
    draft.url = link.url;
    draft.title = link.title;
  });
  await transaction.isPersisted.promise;
}

export async function removeLink(linkId: string) {
  await taskLinkCollection.delete(linkId).isPersisted.promise;
}
