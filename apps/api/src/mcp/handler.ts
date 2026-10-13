import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerMcpTools } from "./tools";

/**
 * A stateless MCP handler for one request. SDK v2 serves current and 2025-era
 * clients from the same factory, with a fresh server per request.
 */
export function createMcpRequestHandler(userId: string) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "morrow-mcp", version: "1.0.0" });
    registerMcpTools(server, userId);
    return server;
  });
}
