import { FIELD_TYPES } from "@morrow/sync-schemas";
import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import {
  createdResult,
  fieldListResult,
  fieldUsageResult,
  txidResult,
} from "#api/projects/response";
import { position, projectId, workspaceId } from "#api/projects/schemas";
import {
  fieldConfig,
  fieldId,
  fieldName,
  optionColor,
  optionId,
} from "./schemas";
import { createField } from "./operations/create-field";
import { createOption } from "./operations/create-option";
import { deleteField } from "./operations/delete-field";
import { deleteOption } from "./operations/delete-option";
import { fieldUsage } from "./operations/field-usage";
import { listFields } from "./operations/list-fields";
import { moveField } from "./operations/move-field";
import { moveOption } from "./operations/move-option";
import { updateField } from "./operations/update-field";
import { updateOption } from "./operations/update-option";

const canRead = requireWorkspacePermission({ workspace: ["read"] });
const canUpdate = requireWorkspacePermission({ project: ["update"] });

const forProject = z.object({ workspaceId, projectId });
const forField = forProject.extend({ fieldId });
const forOption = forField.extend({ optionId });

const create = authed
  .input(
    forProject.extend({
      name: fieldName,
      type: z.enum(FIELD_TYPES).default("single_choice"),
      config: fieldConfig.optional(),
    }),
  )
  .use(canUpdate)
  .output(createdResult)
  .handler(({ input }) =>
    createField(input.workspaceId, input.projectId, {
      name: input.name,
      type: input.type,
      config: input.config,
    }),
  );

const update = authed
  .input(
    forField
      .extend({ name: fieldName.optional(), config: fieldConfig.optional() })
      .refine(
        (input) => input.name !== undefined || input.config !== undefined,
      ),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateField(input.workspaceId, input.projectId, input.fieldId, {
      name: input.name,
      config: input.config,
    }),
  );

const move = authed
  .input(forField.extend({ position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveField(
      input.workspaceId,
      input.projectId,
      input.fieldId,
      input.position,
    ),
  );

const remove = authed
  .input(forField)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    deleteField(input.workspaceId, input.projectId, input.fieldId),
  );

const list = authed
  .input(forProject)
  .use(canRead)
  .output(fieldListResult)
  .handler(({ input }) => listFields(input.workspaceId, input.projectId));

const usage = authed
  .input(forProject)
  .use(canRead)
  .output(fieldUsageResult)
  .handler(({ input }) => fieldUsage(input.projectId));

const createOptionProcedure = authed
  .input(forField.extend({ name: fieldName, color: optionColor.optional() }))
  .use(canUpdate)
  .output(createdResult)
  .handler(({ input }) =>
    createOption(input.workspaceId, input.projectId, input.fieldId, {
      name: input.name,
      color: input.color,
    }),
  );

const updateOptionProcedure = authed
  .input(
    forOption
      .extend({
        name: fieldName.optional(),
        color: optionColor.optional(),
      })
      .refine((input) => input.name !== undefined || input.color !== undefined),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateOption(
      input.workspaceId,
      input.projectId,
      input.fieldId,
      input.optionId,
      { name: input.name, color: input.color },
    ),
  );

const moveOptionProcedure = authed
  .input(forOption.extend({ position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveOption(
      input.workspaceId,
      input.projectId,
      input.fieldId,
      input.optionId,
      input.position,
    ),
  );

const removeOption = authed
  .input(forOption)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    deleteOption(
      input.workspaceId,
      input.projectId,
      input.fieldId,
      input.optionId,
    ),
  );

export const fieldsRouter = {
  list,
  create,
  update,
  move,
  remove,
  usage,
  options: {
    create: createOptionProcedure,
    update: updateOptionProcedure,
    move: moveOptionProcedure,
    remove: removeOption,
  },
};
