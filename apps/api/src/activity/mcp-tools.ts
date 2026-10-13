import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const activityMcpTools = [
  mcpTool({
    name: "list_activity",
    description:
      "List a page of recent activity in a workspace. Pass nextCursor to read the next page.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      cursor: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: (args, client) => client.activity.list(args),
  }),
];
