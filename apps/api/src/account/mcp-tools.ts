import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const accountMcpTools = [
  mcpTool({
    name: "whoami",
    description: "Return the current Morrow user.",
    inputSchema: z.object({}),
    run: (_args, client) => client.account.me(),
  }),
];
