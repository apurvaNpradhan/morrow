import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();

beforeEach(resetTestDatabase);

const code = (error: unknown) => (error as ORPCError<string, unknown>).code;

async function seedActivity(workspaceId: string, userId: string, count = 3) {
  for (let i = 0; i < count; i++) {
    await db.insert(schema.activityTable).values({
      workspaceId,
      resourceType: "workspace",
      resourceId: workspaceId,
      type: "workspace_updated",
      actorUserId: userId,
      content: `change ${i}`,
      eventData: {},
      createdAt: new Date(Date.now() + i * 1000),
    });
  }
}

describe("activity.list", () => {
  it("pages a member's workspace activity newest first", async () => {
    const { user, workspace } = await createWorkspaceMember();
    await seedActivity(workspace.id, user.id);
    mockAuthenticatedSession(user);
    const client = createTestClient(app);

    const first = await client.activity.list({
      workspaceId: workspace.id,
      limit: 2,
    });
    expect(first.items.map((i) => i.content)).toEqual(["change 2", "change 1"]);
    expect(first.items[0].actorName).toBe(user.name);

    const second = await client.activity.list({
      workspaceId: workspace.id,
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((i) => i.content)).toEqual(["change 0"]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects an unauthenticated call with UNAUTHORIZED", async () => {
    const { workspace } = await createWorkspaceMember();
    mockAnonymousSession();
    const error = await createTestClient(app)
      .activity.list({ workspaceId: workspace.id })
      .catch((e: unknown) => e);
    expect(code(error)).toBe("UNAUTHORIZED");
  });

  it("rejects a user from another workspace with NOT_FOUND", async () => {
    const { workspace } = await createWorkspaceMember();
    const { user: outsider } = await createWorkspaceMember();
    mockAuthenticatedSession(outsider);
    const error = await createTestClient(app)
      .activity.list({ workspaceId: workspace.id })
      .catch((e: unknown) => e);
    expect(code(error)).toBe("NOT_FOUND");
  });

  it("rejects a malformed cursor with BAD_REQUEST", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const error = await createTestClient(app)
      .activity.list({ workspaceId: workspace.id, cursor: "nonsense" })
      .catch((e: unknown) => e);
    expect(code(error)).toBe("BAD_REQUEST");
  });
});
