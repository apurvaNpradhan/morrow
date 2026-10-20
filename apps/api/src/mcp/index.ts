import { isJsonContentType } from "@modelcontextprotocol/server";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { Hono } from "hono";
import {
  auth,
  MCP_RESOURCE,
  OAUTH_ISSUER,
  verifyMcpToken,
} from "#api/auth/index";
import { createMcpRequestHandler } from "./handler";

const origin = new URL(MCP_RESOURCE).origin;
const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource/api/mcp`;

/** The MCP endpoint, mounted under /api. OAuth itself is Better Auth's, under /api/auth/oauth2. */
export const mcpRoutes = new Hono().all("/mcp", async (c) => {
  const userId = await verifyMcpToken(c.req.header("authorization"));
  if (!userId) {
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="${resourceMetadataUrl}"`,
    );
    return c.json(
      {
        error: "invalid_token",
        error_description: "Missing or invalid token",
      },
      401,
    );
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  if (!isJsonContentType(c.req.header("content-type"))) {
    return c.json({ error: "Unsupported Media Type" }, 415);
  }

  // SDK v2 serves current and 2025-era clients statelessly from one factory,
  // so any replica can answer any request.
  return createMcpRequestHandler(userId).fetch(c.req.raw);
});

/** Discovery documents clients fetch from the origin root (RFC 9728 and RFC 8414). */
export const mcpWellKnownRoutes = new Hono()
  .get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
    c.json({
      resource: MCP_RESOURCE,
      authorization_servers: [OAUTH_ISSUER],
      bearer_methods_supported: ["header"],
    }),
  )
  .get("/.well-known/oauth-authorization-server/api/auth", (c) =>
    oauthProviderAuthServerMetadata(auth)(c.req.raw),
  );
