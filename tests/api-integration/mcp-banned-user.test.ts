import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpClient } from "./helpers/mcp-oauth";
import { signInWithOtp } from "./helpers/otp";

const protocolVersion = "2026-07-28";

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await signInWithOtp(
    (path, body) =>
      app.request(`/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        body: JSON.stringify(body),
      }),
    `${randomUUID()}@example.com`,
    { name: "MCP user" },
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    token: string;
    user: { id: string };
  };
  return {
    token: await connectMcpClient(app, body.token),
    userId: body.user.id,
  };
}

function initialize(app: ReturnType<typeof createApp>["app"], token: string) {
  return app.request("/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": "initialize",
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "morrow-banned-user-test", version: "1.0.0" },
      },
    }),
  });
}

describe("API integration: MCP access for banned users", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stops serving an access token once its owner is banned", async () => {
    const { app } = createApp();
    const { token, userId } = await signUp(app);

    expect((await initialize(app, token)).status).not.toBe(401);

    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, userId));

    expect((await initialize(app, token)).status).toBe(401);
  });
});
