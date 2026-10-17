import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import {
  projectColor,
  projectDescription,
  projectIcon,
  projectKey,
  projectName,
} from "./schemas";

const workspace = z.object({ workspaceId: z.string().trim().min(1) });
const project = workspace.extend({ projectId: z.string().trim().min(1) });

export const projectsMcpTools = [
  mcpTool({
    name: "list_projects",
    description:
      "List the projects of a workspace, each with its columns in board order (name, category, colour).",
    inputSchema: z.object({ workspaceId: z.string().trim().min(1) }),
    run: async ({ workspaceId }, client) =>
      (await client.projects.list({ workspaceId })).map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        icon: project.icon,
        color: project.color,
        archivedAt: project.archivedAt,
        columns: project.columns.map(({ id, name, category, color }) => ({
          id,
          name,
          category,
          color,
        })),
      })),
  }),
  mcpTool({
    name: "create_project",
    description:
      "Create a project. The key (2-6 letters or digits) prefixes its ticket ids, like MOR-12. It starts with a default set of columns.",
    inputSchema: workspace.extend({
      name: projectName,
      key: projectKey,
      description: projectDescription.optional(),
      icon: projectIcon.optional(),
      color: projectColor.optional(),
    }),
    run: async (input, client) => ({
      projectId: (await client.projects.create(input)).id,
    }),
  }),
  mcpTool({
    name: "update_project",
    description:
      "Change a project. Only the fields you pass change; null clears description, icon and color. archived archives or restores it.",
    inputSchema: project.extend({
      name: projectName.optional(),
      description: projectDescription.nullable().optional(),
      icon: projectIcon.nullable().optional(),
      color: projectColor.nullable().optional(),
      archived: z.boolean().optional(),
    }),
    run: async ({ archived, ...input }, client) => {
      const { workspaceId, projectId, ...fields } = input;
      if (Object.values(fields).some((value) => value !== undefined)) {
        await client.projects.update(input);
      }
      if (archived !== undefined) {
        const scope = { workspaceId, projectId };
        await (archived
          ? client.projects.archive(scope)
          : client.projects.unarchive(scope));
      }
      return { projectId, updated: true };
    },
  }),
  mcpTool({
    name: "delete_project",
    description:
      "Permanently delete a project with all its tasks. Archive it instead to keep it.",
    inputSchema: project,
    run: async (input, client) => {
      await client.projects.remove(input);
      return { projectId: input.projectId, deleted: true };
    },
  }),
];
