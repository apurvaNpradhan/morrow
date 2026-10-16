import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { columnsRouter } from "./columns/procedures";
import { changeProjectKey } from "./operations/change-project-key";
import { createProject } from "./operations/create-project";
import { deleteProject } from "./operations/delete-project";
import { listProjects } from "./operations/list-projects";
import { reorderProject } from "./operations/reorder-project";
import { saveProjectBackground } from "./operations/save-project-background";
import { setProjectArchived } from "./operations/set-project-archived";
import { setProjectBackground } from "./operations/set-project-background";
import { updateProject } from "./operations/update-project";
import {
  backgroundRemovedResult,
  backgroundResult,
  createdResult,
  nullableTxid,
  projectWithColumnsSchema,
  txidResult,
} from "./response";
import {
  position,
  projectDescription,
  projectColor,
  projectIcon,
  projectId,
  projectKey,
  projectName,
  workspaceId,
} from "./schemas";

const canRead = requireWorkspacePermission({ workspace: ["read"] });
const canCreate = requireWorkspacePermission({ project: ["create"] });
const canUpdate = requireWorkspacePermission({ project: ["update"] });
const canDelete = requireWorkspacePermission({ project: ["delete"] });

const forProject = z.object({ workspaceId, projectId });

const list = authed
  .input(z.object({ workspaceId }))
  .use(canRead)
  .output(z.array(projectWithColumnsSchema))
  .handler(({ input }) => listProjects(input.workspaceId));

const create = authed
  .input(
    z.object({
      workspaceId,
      name: projectName,
      key: projectKey,
      icon: projectIcon.optional(),
      color: projectColor.optional(),
      description: projectDescription.optional(),
    }),
  )
  .use(canCreate)
  .output(createdResult)
  .handler(({ input }) => createProject(input));

const update = authed
  .input(
    z
      .object({
        workspaceId,
        projectId,
        name: projectName.optional(),
        description: projectDescription.nullable().optional(),
        icon: projectIcon.nullable().optional(),
        color: projectColor.nullable().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.icon !== undefined ||
          input.color !== undefined,
      ),
  )
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    updateProject(input.workspaceId, input.projectId, {
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
    }),
  );

const changeKey = authed
  .input(forProject.extend({ key: projectKey }))
  .use(canUpdate)
  .output(z.object({ txid: nullableTxid }))
  .handler(({ input }) =>
    changeProjectKey(input.workspaceId, input.projectId, input.key),
  );

const reorder = authed
  .input(forProject.extend({ position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    reorderProject(input.workspaceId, input.projectId, input.position),
  );

const archive = authed
  .input(forProject)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setProjectArchived(input.workspaceId, input.projectId, true),
  );

const unarchive = authed
  .input(forProject)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setProjectArchived(input.workspaceId, input.projectId, false),
  );

const remove = authed
  .input(forProject)
  .use(canDelete)
  .output(txidResult)
  .handler(({ input }) => deleteProject(input.workspaceId, input.projectId));

const uploadBackground = authed
  .input(forProject.extend({ file: z.instanceof(Blob) }))
  .use(canUpdate)
  .output(backgroundResult)
  .handler(({ input }) =>
    saveProjectBackground(input.workspaceId, input.projectId, input.file),
  );

const removeBackground = authed
  .input(forProject)
  .use(canUpdate)
  .output(backgroundRemovedResult)
  .handler(async ({ input }) => {
    const { hadBackground, txid } = await setProjectBackground(
      input.workspaceId,
      input.projectId,
      null,
    );
    return { deleted: hadBackground, txid };
  });

export const projectsRouter = {
  list,
  create,
  update,
  changeKey,
  reorder,
  archive,
  unarchive,
  remove,
  uploadBackground,
  removeBackground,
  columns: columnsRouter,
};
