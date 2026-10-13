import type { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();

beforeEach(resetTestDatabase);

describe("account.export", () => {
  it("rejects an unauthenticated call", async () => {
    mockAnonymousSession();
    const error = await createTestClient(app)
      .account.export()
      .catch((e: unknown) => e);
    expect((error as ORPCError<string, unknown>).code).toBe("UNAUTHORIZED");
  });

  it("returns the caller's own data, omits others", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Alpha",
    });
    const other = await createWorkspaceMember();
    await db.insert(schema.activityTable).values([
      {
        workspaceId: workspace.id,
        resourceType: "workspace",
        resourceId: workspace.id,
        type: "workspace_updated",
        actorUserId: user.id,
        content: "I did it",
        eventData: {},
      },
      {
        workspaceId: other.workspace.id,
        resourceType: "workspace",
        resourceId: other.workspace.id,
        type: "workspace_updated",
        actorUserId: other.user.id,
        content: "They did it",
        eventData: {},
      },
    ]);
    mockAuthenticatedSession(user);

    const data = await createTestClient(app).account.export();

    expect(data.profile?.email).toBe(user.email);
    expect(data.memberships.map((m) => m.workspaceName)).toEqual(["Alpha"]);
    expect(data.activity.map((a) => a.content)).toEqual(["I did it"]);
  });
});
