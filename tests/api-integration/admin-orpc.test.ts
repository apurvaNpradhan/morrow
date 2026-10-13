import type { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();
const code = (error: unknown) => (error as ORPCError<string, unknown>).code;

beforeEach(resetTestDatabase);

async function signUp(email: string, admin = false) {
  const { userId, cookies } = await signUpWithSession(app, {
    email,
    name: email.split("@")[0],
  });
  if (admin) {
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, userId));
  }
  return { userId, client: createTestClient(app, { cookie: cookies }) };
}

describe("admin procedures", () => {
  it("lets only instance administrators in", async () => {
    const member = await signUp("member@example.com");
    const admin = await signUp("boss@example.com", true);

    const denied = await member.client.admin.access().catch((e: unknown) => e);
    expect(code(denied)).toBe("FORBIDDEN");
    const listDenied = await member.client.admin.users
      .list({})
      .catch((e: unknown) => e);
    expect(code(listDenied)).toBe("FORBIDDEN");

    expect(await admin.client.admin.access()).toEqual({ admin: true });
    const users = await admin.client.admin.users.list({});
    expect(users.total).toBe(2);
  });

  it("edits, deactivates and deletes a user", async () => {
    const admin = await signUp("boss@example.com", true);
    const target = await signUp("target@example.com");

    await admin.client.admin.users.update({
      userId: target.userId,
      name: "Renamed",
      email: "target@example.com",
    });
    const [renamed] = await db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.id, target.userId));
    expect(renamed.name).toBe("Renamed");

    await admin.client.admin.users.setDeactivated({
      userId: target.userId,
      deactivate: true,
    });
    const [banned] = await db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.id, target.userId));
    expect(banned.banned).toBe(true);

    await admin.client.admin.users.setDeactivated({
      userId: target.userId,
      deactivate: false,
    });
    await admin.client.admin.users.remove({ userId: target.userId });
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.id, target.userId)),
    ).toHaveLength(0);
  });

  it("manages another workspace's members", async () => {
    const admin = await signUp("boss@example.com", true);
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const { user: newcomer } = await createWorkspaceMember();

    const { workspaces } = await admin.client.admin.workspaces.list({});
    expect(workspaces.map((w) => w.id)).toContain(workspace.id);

    const added = await admin.client.admin.workspaces.addMember({
      workspaceId: workspace.id,
      userId: newcomer.id,
      role: "member",
    });
    expect(added.map((m) => m.userId)).toContain(newcomer.id);

    const promoted = await admin.client.admin.workspaces.updateMemberRole({
      workspaceId: workspace.id,
      userId: newcomer.id,
      role: "admin",
    });
    expect(promoted.find((m) => m.userId === newcomer.id)?.role).toBe("admin");

    const transferred = await admin.client.admin.workspaces.transferOwnership({
      workspaceId: workspace.id,
      userId: newcomer.id,
    });
    expect(transferred.find((m) => m.userId === newcomer.id)?.role).toBe(
      "owner",
    );

    const after = await admin.client.admin.workspaces.removeMember({
      workspaceId: workspace.id,
      userId: owner.id,
    });
    expect(after.map((m) => m.userId)).not.toContain(owner.id);

    expect(
      await admin.client.admin.workspaces.roles({ workspaceId: workspace.id }),
    ).toContain("member");
  });
});
