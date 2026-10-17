import { createId } from "@paralleldrive/cuid2";
import type { TaskRow } from "@morrow/sync-schemas";
import { taskCommentCollection } from "../collections/task-comment-collection";

/*
 * The writes the timeline makes. Each shows at once and resolves when the
 * change has come back through sync; a refusal rolls it back and rejects.
 */

export async function postComment(
  task: Pick<TaskRow, "id" | "projectId">,
  authorId: string,
  body: string,
) {
  const now = new Date();
  const transaction = taskCommentCollection.insert({
    id: createId(),
    taskId: task.id,
    projectId: task.projectId,
    authorId,
    body,
    createdAt: now,
    editedAt: null,
    updatedAt: now,
  });
  await transaction.isPersisted.promise;
}

export async function editComment(commentId: string, body: string) {
  const transaction = taskCommentCollection.update(commentId, (draft) => {
    draft.body = body;
    draft.editedAt = new Date();
  });
  await transaction.isPersisted.promise;
}

export async function deleteComment(commentId: string) {
  await taskCommentCollection.delete(commentId).isPersisted.promise;
}
