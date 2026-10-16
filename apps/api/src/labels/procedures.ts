import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { createLabel } from "./operations/create-label";
import { deleteLabel } from "./operations/delete-label";
import { labelUsage } from "./operations/label-usage";
import { moveLabel } from "./operations/move-label";
import { updateLabel } from "./operations/update-label";
import {
  labelColor,
  labelId,
  labelName,
  newLabelId,
  position,
  workspaceId,
} from "./schemas";
import { createdResult, txidResult, usageResult } from "./response";

const canRead = requireWorkspacePermission({ workspace: ["read"] });
const canCreate = requireWorkspacePermission({ label: ["create"] });
const canUpdate = requireWorkspacePermission({ label: ["update"] });
const canDelete = requireWorkspacePermission({ label: ["delete"] });

const create = authed
  .input(
    z.object({
      workspaceId,
      id: newLabelId,
      name: labelName,
      color: labelColor,
      position,
    }),
  )
  .use(canCreate)
  .output(createdResult)
  .handler(({ input }) => {
    const { workspaceId: workspace, ...label } = input;
    return createLabel(workspace, label);
  });

const update = authed
  .input(
    z
      .object({
        workspaceId,
        labelId,
        name: labelName.optional(),
        color: labelColor.optional(),
      })
      .refine((input) => input.name !== undefined || input.color !== undefined),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateLabel(input.workspaceId, input.labelId, {
      name: input.name,
      color: input.color,
    }),
  );

const move = authed
  .input(z.object({ workspaceId, labelId, position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveLabel(input.workspaceId, input.labelId, input.position),
  );

const remove = authed
  .input(z.object({ workspaceId, labelId }))
  .use(canDelete)
  .output(txidResult)
  .handler(({ input }) => deleteLabel(input.workspaceId, input.labelId));

const usage = authed
  .input(z.object({ workspaceId }))
  .use(canRead)
  .output(usageResult)
  .handler(({ input }) => labelUsage(input.workspaceId));

export const labelsRouter = { create, update, move, delete: remove, usage };
