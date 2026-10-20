import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { pdfBytes, pngBytes, uploadAsset } from "./helpers/assets";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpClient } from "./helpers/mcp-oauth";
import { signInWithOtp } from "./helpers/otp";
import { setupTasks } from "./helpers/tasks";

const { app } = createApp();

beforeEach(resetTestDatabase);

/** An uploaded, finalized asset, attached to a task unless `draft` is set. */
async function storedAsset(
  file: { filename: string; contentType: string; bytes: Uint8Array },
  { draft = false } = {},
) {
  const context = await setupTasks();
  const task = await context.addTask("To Do");
  const assetId = await uploadAsset(context.client, context.workspace.id, file);
  await context.client.assets.finalize({
    workspaceId: context.workspace.id,
    assetId,
  });
  if (!draft) {
    await db
      .update(schema.assetTable)
      .set({ taskId: task.id, attachedAt: new Date() })
      .where(eq(schema.assetTable.id, assetId));
  }
  return { ...context, assetId };
}

const get = (id: string, headers: Record<string, string> = {}) =>
  app.request(`/api/asset/${id}`, { headers, redirect: "manual" });

describe("downloading an asset", () => {
  it("redirects a member to a short-lived link that shows a PDF inline", async () => {
    const { owner, assetId } = await storedAsset({
      filename: "report.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    mockAuthenticatedSession(owner);

    const response = await get(assetId);

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(location.searchParams.get("response-content-disposition")).toMatch(
      /^inline; filename="report\.pdf"/,
    );
    expect(location.searchParams.get("response-content-type")).toBe(
      "application/pdf",
    );
    const bytes = new Uint8Array(await (await fetch(location)).arrayBuffer());
    expect(bytes).toEqual(pdfBytes());
  });

  it("downloads a viewable file when asked to", async () => {
    const { owner, assetId } = await storedAsset({
      filename: "report.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    mockAuthenticatedSession(owner);

    const location = new URL(
      (await get(`${assetId}?download=1`)).headers.get("location")!,
    );

    expect(location.searchParams.get("response-content-disposition")).toMatch(
      /^attachment; filename="report\.pdf"/,
    );
  });

  it("forces everything else to download as a binary file", async () => {
    const { owner, assetId } = await storedAsset({
      filename: "page.html",
      contentType: "text/html",
      bytes: new TextEncoder().encode("<script>alert(1)</script>"),
    });
    mockAuthenticatedSession(owner);

    const location = new URL((await get(assetId)).headers.get("location")!);

    expect(location.searchParams.get("response-content-disposition")).toMatch(
      /^attachment; filename="page\.html"/,
    );
    expect(location.searchParams.get("response-content-type")).toBe(
      "application/octet-stream",
    );
  });

  it("shows an image inline with its sniffed type", async () => {
    const { owner, assetId } = await storedAsset({
      filename: "shot.png",
      contentType: "application/octet-stream",
      bytes: pngBytes(),
    });
    mockAuthenticatedSession(owner);

    const location = new URL((await get(assetId)).headers.get("location")!);

    expect(location.searchParams.get("response-content-type")).toBe(
      "image/png",
    );
    expect(location.searchParams.get("response-content-disposition")).toMatch(
      /^inline/,
    );
  });

  it("refuses anonymous callers and non-members", async () => {
    const { assetId } = await storedAsset({
      filename: "a.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    mockAnonymousSession();
    expect((await get(assetId)).status).toBe(401);

    const { owner: outsider } = await storedAsset({
      filename: "b.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    mockAuthenticatedSession(outsider);
    // A workspace you do not belong to does not admit it exists.
    expect((await get(assetId)).status).toBe(404);
  });

  it("keeps a draft private to its uploader", async () => {
    const { workspace, owner, assetId } = await storedAsset(
      { filename: "a.pdf", contentType: "application/pdf", bytes: pdfBytes() },
      { draft: true },
    );
    const teammate = await addWorkspaceMember(workspace.id, "member");

    mockAuthenticatedSession(teammate);
    expect((await get(assetId)).status).toBe(403);

    mockAuthenticatedSession(owner);
    expect((await get(assetId)).status).toBe(302);
  });

  it("answers 404 for an unknown asset", async () => {
    const { owner } = await storedAsset({
      filename: "a.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    mockAuthenticatedSession(owner);

    expect((await get("doesnotexist")).status).toBe(404);
  });

  it("serves an agent holding an MCP access token", async () => {
    const { workspace, assetId } = await storedAsset({
      filename: "a.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes(),
    });
    const signedUp = await signInWithOtp(
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
      { name: "Agent" },
    );
    const { token, user } = (await signedUp.json()) as {
      token: string;
      user: { id: string };
    };
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const mcpToken = await connectMcpClient(app, token);

    const response = await get(assetId, {
      authorization: `Bearer ${mcpToken}`,
    });

    expect(response.status).toBe(302);
  });
});
