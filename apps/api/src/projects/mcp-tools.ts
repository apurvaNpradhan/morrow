import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import {
  projectColor,
  projectDescription,
  projectIcon,
  projectKey,
  projectName,
} from "./schemas";

/** Any icon name on the wire: the full list would add thousands of tokens to the tool list. */
const iconName = z
  .string()
  .refine(
    (name) => projectIcon.safeParse(name).success,
    "Unknown icon. Use a Lucide icon name like Rocket or Bug, a single emoji, or omit it.",
  )
  .describe(
    "A Lucide icon name, for example Rocket, Bug or Database, or a single emoji such as 🚀.",
  );

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
      icon: iconName.optional(),
      color: projectColor.optional(),
    }),
    run: async ({ icon, ...input }, client) => {
      const { id } = await client.projects.create({
        ...input,
        icon: icon === undefined ? undefined : projectIcon.parse(icon),
      });
      const created = (
        await client.projects.list({ workspaceId: input.workspaceId })
      ).find((project) => project.id === id);
      return {
        projectId: id,
        columns: created?.columns.map(({ name, category }) => ({
          name,
          category,
        })),
      };
    },
  }),
  mcpTool({
    name: "update_project",
    description:
      "Change a project. Only the fields you pass change; null clears description, icon and color. color is #rrggbb hex. archived archives or restores it.",
    inputSchema: project.extend({
      name: projectName.optional(),
      description: projectDescription.nullable().optional(),
      icon: iconName.nullable().optional(),
      color: projectColor.nullable().optional(),
      archived: z.boolean().optional(),
    }),
    run: async ({ archived, icon, ...rest }, client) => {
      const input = {
        ...rest,
        icon: icon == null ? icon : projectIcon.parse(icon),
      };
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
