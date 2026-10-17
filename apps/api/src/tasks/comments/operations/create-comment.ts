import { COMMENT_ID_PATTERN, ticketId } from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { taskCommentTable, taskTable } from "#api/tasks/tables";

/**
 * Posts a comment. The id comes from the browser so the comment can appear
 * before the server answers. Runs under the project lock, so an archived
 * Project refuses it; an archived task does not. The task's count moves in the
 * same transaction, and the workspace activity feed hears of it (without the
 * text).
 */
export async function createComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  authorId: string,
  input: { id: string; body: string },
) {
  if (!COMMENT_ID_PATTERN.test(input.id)) throw taskError("INVALID_COMMENT_ID");
  try {
    const { txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      const task = await findTask(tx, projectId, taskId);
      await tx.insert(taskCommentTable).values({
        id: input.id,
        taskId,
        projectId,
        authorId,
        body: input.body,
      });
      await tx
        .update(taskTable)
        .set({ commentCount: sql`${taskTable.commentCount} + 1` })
        .where(eq(taskTable.id, taskId));
      await recordWorkspaceActivity(
        {
          type: "comment.created",
          workspaceId,
          projectId,
          taskId,
          ticketId: ticketId(project.key, task.number),
          taskTitle: task.title,
        },
        tx,
      );
    });
    return { id: input.id, txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
