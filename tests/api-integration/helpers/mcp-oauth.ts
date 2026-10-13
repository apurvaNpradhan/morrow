import { createHash, randomBytes } from "node:crypto";
import { expect } from "vite-plus/test";
import type { createApp } from "../../../apps/api/src/index";
import { db, schema } from "../../../apps/api/src/platform/database";

type App = ReturnType<typeof createApp>["app"];

const REDIRECT = "http://localhost:8123/callback";
export const MCP_RESOURCE = "http://localhost:1337/api/mcp";

/**
 * Runs the flow an MCP client performs for a signed-in user (register, authorize,
 * consent, token) and returns its OAuth access token.
 */
export async function connectMcpClient(app: App, sessionToken: string) {
  // The plugin seeds the MCP resource once at startup; resetting the test
  // database removes it, so put it back.
  await db
    .insert(schema.oauthResourceTable)
    .values({
      identifier: MCP_RESOURCE,
      name: MCP_RESOURCE,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
  const bearer = { Authorization: `Bearer ${sessionToken}` };

  const registered = await app.request("/api/auth/oauth2/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Test client",
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  expect(registered.status).toBe(201);
  const { client_id } = (await registered.json()) as { client_id: string };

  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri: REDIRECT,
    scope: "openid",
    state: "xyz",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: MCP_RESOURCE,
  });
  const authorize = await app.request(`/api/auth/oauth2/authorize?${query}`, {
    headers: bearer,
    redirect: "manual",
  });
  expect(authorize.status).toBe(302);
  const consentUrl = new URL(authorize.headers.get("location")!);
  expect(consentUrl.pathname).toBe("/mcp/authorize");

  const consent = await app.request("/api/auth/oauth2/consent", {
    method: "POST",
    headers: {
      ...bearer,
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      accept: true,
      oauth_query: consentUrl.search.slice(1),
    }),
  });
  expect(consent.status).toBe(200);
  const code = new URL(
    ((await consent.json()) as { url: string }).url,
  ).searchParams.get("code")!;

  const token = await app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id,
      code_verifier: verifier,
      resource: MCP_RESOURCE,
    }),
  });
  expect(token.status).toBe(200);
  return ((await token.json()) as { access_token: string }).access_token;
}
