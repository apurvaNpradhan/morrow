import * as email from "@morrow/email";
import type { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";
import { signInWithOtp } from "./helpers/otp";

const origin = "http://localhost:5173";
const { app } = createApp();

async function post(path: string, body: unknown, cookie = "") {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}

/** Signs a real user in and returns a typed client acting as them. */
async function signUp(address: string) {
  const result = await signInWithOtp(
    (path, body, headers) => post(path, body, headers?.cookie),
    address,
    { name: address.split("@")[0] },
  );
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return {
    id: body.user.id as string,
    client: createTestClient(app, { cookie }),
  };
}

const failure = (error: unknown) =>
  error as ORPCError<string, { code?: string }>;

beforeEach(async () => {
  await resetTestDatabase();
  vi.restoreAllMocks();
});

describe("workspace procedures", () => {
  it("creates, lists, edits, activates and deletes a workspace", async () => {
    const { client } = await signUp("owner@example.com");

    const created = await client.workspace.create({
      name: "Alpha",
      slug: "alpha",
      description: "First one",
    });
    expect(created.slug).toBe("alpha");

    const [row] = await db.select().from(schema.workspaceTable);
    expect(row.description).toBe("First one");

    expect((await client.workspace.list()).map((w) => w.slug)).toEqual([
      "alpha",
    ]);

    await client.workspace.update({
      workspaceId: created.id,
      name: "Alpha Two",
    });
    expect((await client.workspace.get({ workspaceId: created.id })).name).toBe(
      "Alpha Two",
    );

    await client.workspace.setActive({ workspaceId: created.id });
    expect(
      await client.workspace.can({
        workspaceId: created.id,
        permissions: { workspace: ["delete"] },
      }),
    ).toEqual({ success: true });

    await client.workspace.remove({ workspaceId: created.id });
    expect(await client.workspace.list()).toEqual([]);
  });

  it("answers a stranger's read with NOT_FOUND and refuses their edit", async () => {
    const owner = await signUp("owner@example.com");
    const stranger = await signUp("stranger@example.com");
    const created = await owner.client.workspace.create({
      name: "Private",
      slug: "private",
    });

    const read = await stranger.client.workspace
      .get({ workspaceId: created.id })
      .catch((e: unknown) => e);
    expect(failure(read).code).toBe("NOT_FOUND");

    const edit = await stranger.client.workspace
      .update({ workspaceId: created.id, name: "Mine now" })
      .catch((e: unknown) => e);
    expect(["FORBIDDEN", "UNAUTHORIZED", "BAD_REQUEST"]).toContain(
      failure(edit).code,
    );
    const [row] = await db.select().from(schema.workspaceTable);
    expect(row.name).toBe("Private");
  });
});

describe("member procedures", () => {
  it("invites, reports an email failure, then accepts and manages the member", async () => {
    const owner = await signUp("owner@example.com");
    const guest = await signUp("guest@example.com");
    const created = await owner.client.workspace.create({
      name: "Team",
      slug: "team",
    });

    const send = vi
      .spyOn(email, "sendWorkspaceInvitationEmail")
      .mockRejectedValueOnce(new Error("provider down"));
    const failed = await owner.client.members
      .invite({
        workspaceId: created.id,
        email: "guest@example.com",
        role: "member",
      })
      .catch((e: unknown) => e);
    expect(failure(failed).code).toBe("BAD_GATEWAY");
    expect(failure(failed).data?.code).toBe("INVITATION_EMAIL_FAILED");

    send.mockResolvedValue(undefined as never);
    await owner.client.members.invite({
      workspaceId: created.id,
      email: "guest@example.com",
      role: "member",
      resend: true,
    });
    const [invitation] = await db.select().from(schema.invitationTable);

    const pending = await guest.client.members.pendingInvitations();
    expect(pending.map((i) => i.id)).toEqual([invitation.id]);

    await guest.client.members.acceptInvitation({
      invitationId: invitation.id,
    });
    const members = await owner.client.members.list({
      workspaceId: created.id,
    });
    expect(members.map((m) => m.role).sort()).toEqual(["member", "owner"]);

    const memberRows = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, created.id));
    const mine = memberRows.find((row) => row.userId === guest.id);
    const ownerMember = memberRows.find((row) => row.userId === owner.id);
    expect(mine?.role).toBe("member");

    await owner.client.members.updateRole({
      workspaceId: created.id,
      memberId: mine!.id,
      role: "admin",
    });
    expect(
      (await guest.client.members.list({ workspaceId: created.id })).find(
        (m) => m.id === guest.id,
      )?.role,
    ).toBe("admin");

    await owner.client.members.transferOwnership({
      workspaceId: created.id,
      newOwnerMemberId: mine!.id,
      currentOwnerMemberId: ownerMember!.id,
    });
    const roles = await guest.client.members.list({ workspaceId: created.id });
    expect(roles.find((m) => m.id === guest.id)?.role).toBe("owner");

    await guest.client.members.remove({
      workspaceId: created.id,
      memberIdOrEmail: "owner@example.com",
    });
    expect(
      await guest.client.members.list({ workspaceId: created.id }),
    ).toHaveLength(1);
  });

  it("lists, creates and deletes custom roles", async () => {
    const owner = await signUp("owner@example.com");
    const created = await owner.client.workspace.create({
      name: "Roles",
      slug: "roles",
    });

    const before = await owner.client.members.roles.list({
      workspaceId: created.id,
    });
    await owner.client.members.roles.create({
      workspaceId: created.id,
      role: "auditor",
      permission: { workspace: ["read"] },
    });
    const after = await owner.client.members.roles.list({
      workspaceId: created.id,
    });
    expect(after.length).toBe(before.length + 1);

    await owner.client.members.roles.remove({
      workspaceId: created.id,
      roleName: "auditor",
    });
    expect(
      await owner.client.members.roles.list({ workspaceId: created.id }),
    ).toHaveLength(before.length);
  });

  it("looks up an invitation publicly", async () => {
    const result = await createTestClient(app).members.publicInvitation({
      id: "missing",
    });
    expect(result.valid).toBe(false);
  });
});
