import { RELATION_TYPES } from "@morrow/sync-schemas";
import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { txidResult } from "#api/tasks/response";
import { taskId, workspaceId } from "#api/tasks/schemas";
import { addRelation } from "./operations/add-relation";
import { removeRelation } from "./operations/remove-relation";

// A relation is part of both its tasks, so changing one takes the permission to edit them.
const canUpdate = requireWorkspacePermission({ task: ["update"] });

const add = authed
  .input(
    z.object({
      workspaceId,
      // A client-chosen id; its format is checked by the operation (INVALID_RELATION_ID).
      id: z.string().min(1).max(64),
      type: z.enum(RELATION_TYPES),
      sourceTaskId: taskId.describe(
        "The task that blocks, or is the duplicate; either one for related.",
      ),
      targetTaskId: taskId,
    }),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input, context }) =>
    addRelation(input.workspaceId, context.user.id, input),
  );

const remove = authed
  .input(z.object({ workspaceId, relationId: z.string().min(1) }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) => removeRelation(input.workspaceId, input.relationId));

export const relationsRouter = { add, delete: remove };
