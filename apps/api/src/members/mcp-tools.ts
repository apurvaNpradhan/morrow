import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const membersMcpTools = [
  mcpTool({
    name: "list_members",
    readOnly: true,
    description: "List members in a workspace.",
    inputSchema: z.object({ workspaceId: z.string().trim().min(1) }),
    run: ({ workspaceId }, client) => client.members.list({ workspaceId }),
  }),
];
