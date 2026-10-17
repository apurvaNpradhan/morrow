import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { taskCommentTable } from "#api/tasks/tables";
import { findComment } from "../lib/find-comment";

/**
 * Edits a comment's text and marks it edited. Only its author may, whatever
 * their role: nobody's words are changed by someone else.
 */
export async function updateComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  editorId: string,
  body: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await findTask(tx, projectId, taskId);
    const comment = await findComment(tx, projectId, taskId, commentId);
    if (comment.authorId !== editorId) throw taskError("COMMENT_NOT_YOURS");
    await tx
      .update(taskCommentTable)
      .set({ body, editedAt: new Date() })
      .where(eq(taskCommentTable.id, commentId));
  });
  return { txid };
}
