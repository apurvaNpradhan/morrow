import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const accountMcpTools = [
  mcpTool({
    name: "whoami",
    description: "Return the current Morrow user.",
    inputSchema: z.object({}),
    run: async (_args, client) => {
      const { id, name, email, role } = await client.account.me();
      return { id, name, email, instanceRole: role };
    },
  }),
];
