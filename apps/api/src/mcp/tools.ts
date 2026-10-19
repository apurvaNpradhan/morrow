import { createRouterClient, ORPCError } from "@orpc/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { accountMcpTools } from "#api/account/index";
import { activityMcpTools } from "#api/activity/index";
import { labelsMcpTools } from "#api/labels/index";
import { membersMcpTools } from "#api/members/index";
import {
  columnsMcpTools,
  fieldsMcpTools,
  projectsMcpTools,
} from "#api/projects/index";
import {
  commentsMcpTools,
  linksMcpTools,
  relationsMcpTools,
  tasksMcpTools,
} from "#api/tasks/index";
import type { McpTool } from "#api/platform/orpc/mcp-tool";
import { appRouter } from "#api/platform/orpc/router";
import { workspaceMcpTools } from "#api/workspace/index";
import { logFailure } from "#api/platform/logger";
import { resolveScope } from "./resolve-scope";

/** Every tool MCP clients see. A vertical adds its tools here. */
export const mcpTools: McpTool[] = [
  ...accountMcpTools,
  ...workspaceMcpTools,
  ...membersMcpTools,
  ...projectsMcpTools,
  ...columnsMcpTools,
  ...fieldsMcpTools,
  ...tasksMcpTools,
  ...commentsMcpTools,
  ...linksMcpTools,
  ...relationsMcpTools,
  ...labelsMcpTools,
  ...activityMcpTools,
] as McpTool[];

function textResult(data: unknown, isError = false): CallToolResult {
  const text = typeof data === "string" ? data : (JSON.stringify(data) ?? "");
  return { content: [{ type: "text", text }], isError };
}

/** Tools that take a ticketId let callers leave projectId out; resolveScope fills it in. */
function advertisedSchema(tool: McpTool) {
  const shape = tool.inputSchema.shape;
  return "ticketId" in shape && "projectId" in shape
    ? tool.inputSchema.extend({
        projectId: shape.projectId
          .optional()
          .describe("Optional; the ticketId's key prefix names the project."),
      })
    : tool.inputSchema;
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
      { description: tool.description, inputSchema: advertisedSchema(tool) },
      async (args: unknown) => {
        try {
          const parsed = (tool.inputSchema as z.ZodObject).safeParse(
            await resolveScope(client, args as Record<string, unknown>),
          );
          if (!parsed.success) {
            return textResult({ error: parsed.error.message }, true);
          }
          return textResult(await tool.run(parsed.data, client));
        } catch (error) {
          // Typed failures are meant for the caller; anything else (driver
          // errors can carry SQL and parameters) stays in the server log.
          if (error instanceof ORPCError) {
            const code = (error.data as { code?: unknown } | undefined)?.code;
            return textResult(
              typeof code === "string"
                ? { error: error.message, code }
                : { error: error.message },
              true,
            );
          }
          logFailure("mcp.tool", { tool: tool.name }, error);
          return textResult({ error: "Internal error" }, true);
        }
      },
    );
  }
}
