import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import {
  columnCategory,
  columnColor,
  columnId,
  columnName,
  position,
  projectId,
  workspaceId,
} from "#api/projects/schemas";
import { createdResult, txidResult } from "#api/projects/response";
import { createColumn } from "./operations/create-column";
import { deleteColumn } from "./operations/delete-column";
import { moveColumn } from "./operations/move-column";
import { updateColumn } from "./operations/update-column";

const canUpdate = requireWorkspacePermission({ project: ["update"] });

const create = authed
  .input(
    z.object({
      workspaceId,
      projectId,
      name: columnName,
      category: columnCategory,
      color: columnColor.optional(),
    }),
  )
  .use(canUpdate)
  .output(createdResult)
  .handler(({ input }) =>
    createColumn(input.workspaceId, input.projectId, {
      name: input.name,
      category: input.category,
      color: input.color,
    }),
  );

const update = authed
  .input(
    z
      .object({
        workspaceId,
        projectId,
        columnId,
        name: columnName.optional(),
        color: columnColor.optional(),
      })
      .refine((input) => input.name !== undefined || input.color !== undefined),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateColumn(input.workspaceId, input.projectId, input.columnId, {
      name: input.name,
      color: input.color,
    }),
  );

const move = authed
  .input(
    z.object({
      workspaceId,
      projectId,
      columnId,
      category: columnCategory,
      position,
    }),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveColumn(input.workspaceId, input.projectId, input.columnId, {
      category: input.category,
      position: input.position,
    }),
  );

const remove = authed
  .input(
    z.object({
      workspaceId,
      projectId,
      columnId,
      targetColumnId: columnId,
    }),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    deleteColumn(
      input.workspaceId,
      input.projectId,
      input.columnId,
      input.targetColumnId,
    ),
  );

export const columnsRouter = { create, update, move, remove };
