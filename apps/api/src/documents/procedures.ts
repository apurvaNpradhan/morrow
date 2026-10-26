import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { createDocument } from "./operations/create-document";
import { deleteDocument } from "./operations/delete-document";
import { moveDocument } from "./operations/move-document";
import { registerClient } from "./operations/register-client";
import {
  archiveDocument,
  restoreDocument,
} from "./operations/set-document-archived";
import { updateDocument } from "./operations/update-document";
import { createdResult, txidResult } from "./response";
import {
  documentIcon,
  documentId,
  documentTitle,
  newDocumentId,
  parentId,
  position,
  projectId,
  workspaceId,
  yjsClientId,
} from "./schemas";

const canCreate = requireWorkspacePermission({ document: ["create"] });
const canUpdate = requireWorkspacePermission({ document: ["update"] });
const canDelete = requireWorkspacePermission({ document: ["delete"] });

const create = authed
  .input(
    z.object({
      workspaceId,
      id: newDocumentId,
      projectId,
      parentId,
      position,
      title: documentTitle.optional(),
      icon: documentIcon.optional(),
    }),
  )
  .use(canCreate)
  .output(createdResult)
  .handler(({ input, context }) => {
    const { workspaceId: workspace, ...page } = input;
    return createDocument(workspace, context.userId, page);
  });

const update = authed
  .input(
    z
      .object({
        workspaceId,
        documentId,
        title: documentTitle.optional(),
        icon: documentIcon.nullable().optional(),
      })
      .refine((input) => input.title !== undefined || input.icon !== undefined),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateDocument(input.workspaceId, input.documentId, {
      title: input.title,
      icon: input.icon,
    }),
  );

const move = authed
  .input(z.object({ workspaceId, documentId, parentId, projectId, position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveDocument(input.workspaceId, input.documentId, {
      parentId: input.parentId,
      projectId: input.projectId,
      position: input.position,
    }),
  );

const archive = authed
  .input(z.object({ workspaceId, documentId }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) => archiveDocument(input.workspaceId, input.documentId));

const restore = authed
  .input(z.object({ workspaceId, documentId }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) => restoreDocument(input.workspaceId, input.documentId));

const remove = authed
  .input(z.object({ workspaceId, documentId }))
  .use(canDelete)
  .output(txidResult)
  .handler(({ input }) => deleteDocument(input.workspaceId, input.documentId));

const register = authed
  .input(z.object({ workspaceId, documentId, clientId: yjsClientId }))
  .use(canUpdate)
  .output(z.object({}))
  .handler(async ({ input, context }) => {
    await registerClient(
      input.workspaceId,
      context.userId,
      input.documentId,
      input.clientId,
    );
    return {};
  });

export const documentsRouter = {
  create,
  update,
  move,
  archive,
  restore,
  delete: remove,
  registerClient: register,
};
