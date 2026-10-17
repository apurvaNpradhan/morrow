import { z } from "zod";
import {
  authed,
  requireWorkspacePermission,
  userCan,
} from "#api/platform/orpc/base";
import { txidResult } from "#api/tasks/response";
import {
  commentBody,
  commentId,
  newCommentId,
  projectId,
  taskId,
  workspaceId,
} from "#api/tasks/schemas";
import { createComment } from "./operations/create-comment";
import { deleteComment } from "./operations/delete-comment";
import { updateComment } from "./operations/update-comment";

// Every role may comment, Viewers included; editing is the author's alone and
// deleting is the author's or a moderator's, both checked in the operation.
const canComment = requireWorkspacePermission({ comment: ["create"] });
const canRead = requireWorkspacePermission({ workspace: ["read"] });

const forTask = z.object({ workspaceId, projectId, taskId });

const create = authed
  .input(forTask.extend({ id: newCommentId, body: commentBody }))
  .use(canComment)
  .output(txidResult.extend({ id: z.string() }))
  .handler(({ input, context }) =>
    createComment(
      input.workspaceId,
      input.projectId,
      input.taskId,
      context.user.id,
      { id: input.id, body: input.body },
    ),
  );

const update = authed
  .input(forTask.extend({ commentId, body: commentBody }))
  .use(canRead)
  .output(txidResult)
  .handler(({ input, context }) =>
    updateComment(
      input.workspaceId,
      input.projectId,
      input.taskId,
      input.commentId,
      context.user.id,
      input.body,
    ),
  );

const remove = authed
  .input(forTask.extend({ commentId }))
  .use(canRead)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    deleteComment(
      input.workspaceId,
      input.projectId,
      input.taskId,
      input.commentId,
      {
        userId: context.user.id,
        canDeleteAny: await userCan(context.user, input.workspaceId, {
          comment: ["delete"],
        }),
      },
    ),
  );

export const commentsRouter = { create, update, delete: remove };
