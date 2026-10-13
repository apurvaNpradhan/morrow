import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const workspaceMcpTools = [
  mcpTool({
    name: "list_workspaces",
    description: "List workspaces the signed-in user can access.",
    inputSchema: z.object({}),
    run: (_args, client) => client.workspace.list(),
  }),
];
