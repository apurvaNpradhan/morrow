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

  it("includes the projects and columns of the caller's workspaces, not others'", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(user);
    const client = createTestClient(app);
    await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
      icon: "Rocket",
    });
    mockAuthenticatedSession(other.user);
    await createTestClient(app).projects.create({
      workspaceId: other.workspace.id,
      name: "Secret",
      key: "SEC",
    });
    mockAuthenticatedSession(user);

    const data = await client.account.export();

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({
      workspaceId: workspace.id,
      key: "MOR",
      name: "Morrow",
      icon: "Rocket",
      archivedAt: null,
    });
    expect(data.projects[0]?.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });
});
