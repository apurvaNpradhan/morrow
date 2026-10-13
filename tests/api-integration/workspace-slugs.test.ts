import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth/config";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { apiRequest } from "./helpers/api-request";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function setup(slug = "acme") {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  await db
    .update(schema.workspaceTable)
    .set({ slug })
    .where(eq(schema.workspaceTable.id, workspace.id));
  mockAuthenticatedSession(user);
  return { user, workspace: { ...workspace, slug }, request: apiRequest() };
}

async function availability(
  request: ReturnType<typeof apiRequest>,
  slug: string,
  workspaceId?: string,
) {
  const query = new URLSearchParams({ slug });
  if (workspaceId) query.set("workspaceId", workspaceId);
  const response = await request(`/workspace/slug-availability?${query}`);
  expect(response.status).toBe(200);
  return response.json();
}

async function aliases(workspaceId: string) {
  const rows = await db
    .select({ slug: schema.workspaceSlugAliasTable.slug })
    .from(schema.workspaceSlugAliasTable)
    .where(eq(schema.workspaceSlugAliasTable.workspaceId, workspaceId));
  return rows.map((row) => row.slug);
}

describe("GET /api/workspace/slug-availability", () => {
  it("reports availability, format, reserved and taken slugs", async () => {
    const { request } = await setup("acme");

    expect(await availability(request, "fresh-team")).toEqual({
      available: true,
    });
    expect(await availability(request, "Bad Slug")).toEqual({
      available: false,
      reason: "invalid",
    });
    expect(await availability(request, "settings")).toEqual({
      available: false,
      reason: "reserved",
    });
    expect(await availability(request, "acme")).toEqual({
      available: false,
      reason: "taken",
    });
  });

  it("treats another workspace's alias as taken, but not the renamed workspace's own", async () => {
    const { workspace, request } = await setup("acme");
    const other = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceSlugAliasTable).values({
      slug: "old-name",
      workspaceId: other.workspace.id,
    });
    await db.insert(schema.workspaceSlugAliasTable).values({
      slug: "my-old-name",
      workspaceId: workspace.id,
    });

    expect(await availability(request, "old-name", workspace.id)).toEqual({
      available: false,
      reason: "taken",
    });
    expect(await availability(request, "my-old-name", workspace.id)).toEqual({
      available: true,
    });
    expect(await availability(request, "my-old-name")).toEqual({
      available: false,
      reason: "taken",
    });
  });

  it("never reveals who holds a slug", async () => {
    const { request } = await setup("acme");
    const body = await availability(request, "acme");
    expect(Object.keys(body).sort()).toEqual(["available", "reason"]);
  });

  it("rejects unauthenticated requests", async () => {
    await resetTestDatabase();
    const response = await apiRequest()(
      "/workspace/slug-availability?slug=abc",
    );
    expect(response.status).toBe(401);
  });
});

describe("workspace creation enforcement", () => {
  it("rejects a taken or alias-held slug without adding a suffix", async () => {
    const { user, workspace } = await setup("acme");
    await db.insert(schema.workspaceSlugAliasTable).values({
      slug: "former",
      workspaceId: workspace.id,
    });
    const create = (slug: string) =>
      auth.api.createOrganization({
        body: { name: "Another", slug, userId: user.id },
      });

    await expect(create("acme")).rejects.toThrow();
    await expect(create("former")).rejects.toThrow();
    await expect(create("settings")).rejects.toThrow();
    const rows = await db.select().from(schema.workspaceTable);
    expect(rows.map((row) => row.slug)).toEqual(["acme"]);
  });

  it("creates a workspace with exactly the chosen slug", async () => {
    const { user } = await setup("acme");
    const created = await auth.api.createOrganization({
      body: { name: "Brand New", slug: "brand-new", userId: user.id },
    });
    expect(created?.slug).toBe("brand-new");
  });
});

describe("PUT /api/workspace/:id/slug", () => {
  it("renames, keeps the old slug as an alias, and records workspace.updated", async () => {
    const { workspace, request } = await setup("acme");
    const response = await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: "acme-inc" });
    expect(await aliases(workspace.id)).toEqual(["acme"]);
    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.workspaceId, workspace.id));
    expect(rows.map((row) => row.type)).toContain("workspace.updated");
  });

  it("deletes the alias when renaming back", async () => {
    const { workspace, request } = await setup("acme");
    await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });
    const back = await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme" },
    });

    expect(back.status).toBe(200);
    expect(await aliases(workspace.id)).toEqual(["acme-inc"]);
  });

  it("stops another workspace from taking a former slug", async () => {
    const { workspace, request } = await setup("acme");
    await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });
    const other = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(other.user);

    const response = await apiRequest()(
      `/workspace/${other.workspace.id}/slug`,
      {
        method: "PUT",
        body: { slug: "acme" },
      },
    );

    expect(response.status).toBe(409);
  });

  it("rejects invalid and reserved slugs", async () => {
    const { workspace, request } = await setup("acme");
    for (const slug of ["x", "admin"]) {
      const response = await request(`/workspace/${workspace.id}/slug`, {
        method: "PUT",
        body: { slug },
      });
      expect(response.status).toBe(400);
    }
  });

  it("requires the workspace update permission", async () => {
    const { workspace } = await setup("acme");
    const viewer = await addWorkspaceMember(workspace.id, "member");
    mockAuthenticatedSession(viewer);

    const response = await apiRequest()(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });

    expect(response.status).toBe(403);
    expect(await aliases(workspace.id)).toEqual([]);
  });

  it("cannot be bypassed through Better Auth's update endpoint", async () => {
    const { app } = createApp();
    const { userId, cookies } = await signUpWithSession(app, {
      email: "owner@example.com",
      name: "Owner",
    });
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Acme", slug: "acme", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId,
      role: "owner",
      joinedAt: new Date(),
    });
    const update = (data: Record<string, string>) =>
      app.request("/api/auth/organization/update", {
        method: "POST",
        headers: {
          cookie: cookies,
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        body: JSON.stringify({ organizationId: workspace.id, data }),
      });

    expect((await update({ slug: "sneaky" })).status).toBe(400);
    expect((await update({ slug: "settings" })).status).toBe(400);
    expect((await update({ name: "Acme Inc" })).status).toBe(200);
    const [row] = await db
      .select({ slug: schema.workspaceTable.slug })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));
    expect(row?.slug).toBe("acme");
    expect(await aliases(workspace.id)).toEqual([]);
  });

  it("frees current and former slugs when the workspace is deleted", async () => {
    const { workspace, request } = await setup("acme");
    await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });
    await db
      .delete(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));

    expect(await availability(request, "acme")).toEqual({ available: true });
    expect(await availability(request, "acme-inc")).toEqual({
      available: true,
    });
  });
});

describe("GET /api/workspace/by-slug/:slug", () => {
  it("resolves a live slug", async () => {
    const { workspace, request } = await setup("acme");
    const response = await request("/workspace/by-slug/acme");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: workspace.id,
      slug: "acme",
      requestedSlug: "acme",
    });
  });

  it("resolves a former slug to the canonical workspace", async () => {
    const { workspace, request } = await setup("acme");
    await request(`/workspace/${workspace.id}/slug`, {
      method: "PUT",
      body: { slug: "acme-inc" },
    });
    const response = await request("/workspace/by-slug/acme");
    expect(await response.json()).toMatchObject({
      id: workspace.id,
      slug: "acme-inc",
      requestedSlug: "acme",
    });
  });

  it("gives non-members the same not-found as a missing slug", async () => {
    await setup("acme");
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const request = apiRequest();

    const hidden = await request("/workspace/by-slug/acme");
    const missing = await request("/workspace/by-slug/does-not-exist");

    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await hidden.text()).toBe(await missing.text());
  });
});
