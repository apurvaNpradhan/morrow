import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { taskCommentTable, taskTable } from "#api/tasks/tables";
import { findComment } from "../lib/find-comment";

/**
 * Removes a comment and takes it off the task's count. Its author may, and so
 * may anyone holding `comment: delete` (moderation).
 */
export async function deleteComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  actor: { userId: string; canDeleteAny: boolean },
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await findTask(tx, projectId, taskId);
    const comment = await findComment(tx, projectId, taskId, commentId);
    if (comment.authorId !== actor.userId && !actor.canDeleteAny) {
      throw taskError("COMMENT_NOT_YOURS");
    }
    await tx.delete(taskCommentTable).where(eq(taskCommentTable.id, commentId));
    await tx
      .update(taskTable)
      .set({ commentCount: sql`greatest(${taskTable.commentCount} - 1, 0)` })
      .where(eq(taskTable.id, taskId));
  });
  return { txid };
}
