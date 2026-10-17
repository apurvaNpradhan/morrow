import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { commentNotFound } from "#api/tasks/errors";
import { taskCommentTable } from "#api/tasks/tables";

/** A comment of this task of this project; any other comment is "not found". */
export async function findComment(
  tx: DbOrTx,
  projectId: string,
  taskId: string,
  commentId: string,
) {
  const [comment] = await tx
    .select()
    .from(taskCommentTable)
    .where(
      and(
        eq(taskCommentTable.id, commentId),
        eq(taskCommentTable.taskId, taskId),
        eq(taskCommentTable.projectId, projectId),
      ),
    );
  if (!comment) throw commentNotFound();
  return comment;
}
