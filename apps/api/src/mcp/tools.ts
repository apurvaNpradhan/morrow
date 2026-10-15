import { createRouterClient, ORPCError } from "@orpc/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { accountMcpTools } from "#api/account/index";
import { activityMcpTools } from "#api/activity/index";
import { membersMcpTools } from "#api/members/index";
import { projectsMcpTools } from "#api/projects/index";
import { tasksMcpTools } from "#api/tasks/index";
import type { McpTool } from "#api/platform/orpc/mcp-tool";
import { appRouter } from "#api/platform/orpc/router";
import { workspaceMcpTools } from "#api/workspace/index";
import { logFailure } from "#api/platform/logger";

/** Every tool MCP clients see. A vertical adds its tools here. */
export const mcpTools: McpTool[] = [
  ...accountMcpTools,
  ...workspaceMcpTools,
  ...membersMcpTools,
  ...projectsMcpTools,
  ...tasksMcpTools,
  ...activityMcpTools,
] as McpTool[];

function textResult(data: unknown, isError = false): CallToolResult {
  const text =
    typeof data === "string" ? data : (JSON.stringify(data, null, 2) ?? "");
  return { content: [{ type: "text", text }], isError };
}

/**
 * Registers the tools on a server. Each call runs the router in-process as the
 * user behind the verified access token, so tools see exactly what that user's API calls would.
 */
export function registerMcpTools(server: McpServer, userId: string): void {
  const client = createRouterClient(appRouter, {
    context: { headers: new Headers(), mcpUserId: userId },
  });
  for (const tool of mcpTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: unknown) => {
        const parsed = (tool.inputSchema as z.ZodObject).safeParse(args);
        if (!parsed.success) {
          return textResult({ error: parsed.error.message }, true);
        }
        try {
          return textResult(await tool.run(parsed.data, client));
        } catch (error) {
          // Typed failures are meant for the caller; anything else (driver
          // errors can carry SQL and parameters) stays in the server log.
          if (error instanceof ORPCError) {
            return textResult({ error: error.message }, true);
          }
          logFailure("mcp.tool", { tool: tool.name }, error);
          return textResult({ error: "Internal error" }, true);
        }
      },
    );
  }
}
