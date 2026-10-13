import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import type { ORPCError } from "@orpc/client";
import { createTestClient } from "./helpers/orpc";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function completedAt(userId: string) {
  const [row] = await db
    .select({ at: schema.userTable.onboardingCompletedAt })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return row?.at ?? null;
}

describe("onboarding.complete", () => {
  it("sets the timestamp for a named member of a workspace", async () => {
    const { user } = await createWorkspaceMember({ userName: "Ada" });
    mockAuthenticatedSession(user);

    await createTestClient(createApp().app).onboarding.complete();

    expect(await completedAt(user.id)).toBeInstanceOf(Date);
  });

  it("exposes the timestamp on the session", async () => {
    const { app } = createApp();
    const { userId, cookies } = await signUpWithSession(app, {
      email: "session@example.com",
      name: "Session User",
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
    const getSession = async () =>
      (await (
        await app.request("/api/auth/get-session", {
          headers: { cookie: cookies },
        })
      ).json()) as { user: { onboardingCompletedAt?: string | null } };

    expect((await getSession()).user.onboardingCompletedAt ?? null).toBeNull();
    await createTestClient(app, { cookie: cookies }).onboarding.complete();
    expect((await getSession()).user.onboardingCompletedAt).toBeTruthy();
  });

  it("answers CONFLICT when the name is empty", async () => {
    const { user } = await createWorkspaceMember({ userName: " " });
    mockAuthenticatedSession(user);

    const error = await createTestClient(createApp().app)
      .onboarding.complete()
      .catch((e: unknown) => e);

    expect((error as ORPCError<string, unknown>).code).toBe("CONFLICT");
    expect(await completedAt(user.id)).toBeNull();
  });

  it("answers CONFLICT when the user has no workspace", async () => {
    const { user } = await createWorkspaceMember();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, user.id));
    mockAuthenticatedSession(user);

    const error = await createTestClient(createApp().app)
      .onboarding.complete()
      .catch((e: unknown) => e);

    expect((error as ORPCError<string, unknown>).code).toBe("CONFLICT");
    expect(await completedAt(user.id)).toBeNull();
  });

  it("keeps the original timestamp when called again", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const client = createTestClient(createApp().app);

    await client.onboarding.complete();
    const first = await completedAt(user.id);
    await client.onboarding.complete();

    expect(await completedAt(user.id)).toEqual(first);
  });

  it("cannot be written through Better Auth's update-user endpoint", async () => {
    const { app } = createApp();
    const { userId, cookies } = await signUpWithSession(app, {
      email: "writer@example.com",
      name: "Writer",
    });

    await app.request("/api/auth/update-user", {
      method: "POST",
      headers: {
        cookie: cookies,
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        name: "Writer",
        onboardingCompletedAt: new Date().toISOString(),
      }),
    });

    expect(await completedAt(userId)).toBeNull();
  });
});
