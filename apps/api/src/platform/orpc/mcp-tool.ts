import type { RouterClient } from "@orpc/server";
import type { z } from "zod";
import type { AppRouter } from "./router";

/** The router, called in-process as the user behind the MCP token. */
export type McpClient = RouterClient<AppRouter>;

/** A tool a vertical offers to MCP clients. The mcp vertical collects them in one list. */
export type McpTool<S extends z.ZodObject = z.ZodObject> = {
  name: string;
  description: string;
  inputSchema: S;
  /** Never changes anything, so clients may run it without asking. */
  readOnly?: true;
  run(args: z.output<S>, client: McpClient): Promise<unknown>;
};

export function mcpTool<S extends z.ZodObject>(tool: McpTool<S>): McpTool<S> {
  return tool;
}
