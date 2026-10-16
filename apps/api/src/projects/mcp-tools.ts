import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

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
];
