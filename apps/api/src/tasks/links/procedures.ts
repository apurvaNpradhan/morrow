import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { txidResult } from "#api/tasks/response";
import {
  linkId,
  linkTitle,
  linkUrl,
  newLinkId,
  projectId,
  taskId,
  workspaceId,
} from "#api/tasks/schemas";
import { addLink } from "./operations/add-link";
import { removeLink } from "./operations/remove-link";
import { updateLink } from "./operations/update-link";

// Links are part of a task, so changing them takes the permission to edit it.
const canUpdate = requireWorkspacePermission({ task: ["update"] });

const forTask = z.object({ workspaceId, projectId, taskId });

const add = authed
  .input(
    forTask.extend({
      id: newLinkId,
      url: linkUrl,
      title: linkTitle.optional(),
    }),
  )
  .use(canUpdate)
  .output(z.object({ id: z.string(), txid: txidResult.shape.txid.nullable() }))
  .handler(({ input, context }) =>
    addLink(input.workspaceId, input.projectId, input.taskId, context.user.id, {
      id: input.id,
      url: input.url,
      title: input.title ?? null,
    }),
  );

const update = authed
  .input(
    forTask.extend({
      linkId,
      url: linkUrl.optional(),
      title: linkTitle.optional(),
    }),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateLink(input.workspaceId, input.projectId, input.taskId, input.linkId, {
      url: input.url,
      title: input.title,
    }),
  );

const remove = authed
  .input(forTask.extend({ linkId }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    removeLink(input.workspaceId, input.projectId, input.taskId, input.linkId),
  );

export const linksRouter = { add, update, delete: remove };
