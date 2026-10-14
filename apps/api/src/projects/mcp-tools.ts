import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const projectsMcpTools = [
  mcpTool({
    name: "list_projects",
    description:
      "List the projects of a workspace, each with its columns in board order (name, category, colour).",
    inputSchema: z.object({ workspaceId: z.string().trim().min(1) }),
    run: ({ workspaceId }, client) => client.projects.list({ workspaceId }),
  }),
];
