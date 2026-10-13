import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { createApp } from "../../apps/api/src/index";
import { createTestClient } from "./helpers/orpc";
import { statusOf } from "./helpers/status";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

/** The three reads a workspace member may do, by name, for the same workspace. */
const reads = (workspaceId: string) => {
  const client = createTestClient(createApp().app);
  return {
    "workspace.get": () => client.workspace.get({ workspaceId }),
    "members.list": () => client.members.list({ workspaceId }),
    "activity.list": () => client.activity.list({ workspaceId }),
  };
};

async function expectAll(workspaceId: string, status: number) {
  for (const [name, call] of Object.entries(reads(workspaceId))) {
    expect(await statusOf(call()), name).toBe(status);
  }
}

async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
    workspaceName: "Alpha",
  });
  const { user: otherOwner, workspace: other } = await createWorkspaceMember({
    role: "owner",
    workspaceName: "Beta",
  });
  const member = await addWorkspaceMember(workspace.id, "member");
  const { user: outsider } = await createWorkspaceMember({ role: "owner" });
  return { owner, otherOwner, member, outsider, workspace, other };
}

describe("workspace read boundaries", () => {
  it("lets members read details, members and activity", async () => {
    const { member, workspace } = await seed();
    mockAuthenticatedSession(member);

    await expectAll(workspace.id, 200);
    const members = await reads(workspace.id)["members.list"]();
    expect(members.length).toBe(2);
  });

  it("answers users who belong only to another workspace as if it did not exist", async () => {
    const { otherOwner, workspace } = await seed();
    mockAuthenticatedSession(otherOwner);
    await expectAll(workspace.id, 404);
  });

  it("answers a user with no workspace membership at all as if it did not exist", async () => {
    const { workspace } = await seed();
    const { user: loner } = await createWorkspaceMember();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, loner.id));
    mockAuthenticatedSession(loner);
    await expectAll(workspace.id, 404);
  });

  it("denies unauthenticated requests", async () => {
    const { workspace } = await seed();
    mockAnonymousSession();
    await expectAll(workspace.id, 401);
  });

  it("denies a member once their role loses workspace read, and restores it", async () => {
    const { member, workspace } = await seed();
    const [role] = await db
      .insert(schema.workspaceRoleTable)
      .values({
        workspaceId: workspace.id,
        role: "member",
        permission: JSON.stringify({}),
      })
      .returning();
    mockAuthenticatedSession(member);
    await expectAll(workspace.id, 403);

    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: JSON.stringify({ workspace: ["read"] }) })
      .where(
        and(
          eq(schema.workspaceRoleTable.id, role.id),
          eq(schema.workspaceRoleTable.workspaceId, workspace.id),
        ),
      );
    await expectAll(workspace.id, 200);
  });
});
