import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { signUpUser } from "./helpers/real-session";

const { app } = createApp();

beforeEach(resetTestDatabase);

async function addMember(workspaceId: string, userId: string, role = "member") {
  await db
    .insert(schema.workspaceUserTable)
    .values({ workspaceId, userId, role, joinedAt: new Date() });
}

/** An owner with a workspace, and a second real user who is a member of it. */
async function seed() {
  const owner = await signUpUser(app, "owner@example.com");
  const member = await signUpUser(app, "member@example.com");
  const { id: workspaceId } = await owner.client.workspace.create({
    name: "Alpha",
    slug: "alpha",
  });
  await addMember(workspaceId, member.id);
  return { owner, member, workspaceId };
}

const hasMembership = async (workspaceId: string, userId: string) =>
  (
    await db
      .select()
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
          eq(schema.workspaceUserTable.userId, userId),
        ),
      )
  ).length > 0;

describe("membership changes over the real endpoints", () => {
  it("refuses a member who removes someone else with FORBIDDEN, not a lost session", async () => {
    const { member, workspaceId } = await seed();
    const peer = await signUpUser(app, "peer@example.com");
    await addMember(workspaceId, peer.id);
    await expect(
      member.client.members.remove({
        workspaceId,
        memberIdOrEmail: peer.email,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a member leave", async () => {
    const { member, workspaceId } = await seed();

    await member.client.members.leave({ workspaceId });

    expect(await hasMembership(workspaceId, member.id)).toBe(false);
  });

  it("lets an owner remove a member", async () => {
    const { owner, member, workspaceId } = await seed();

    await owner.client.members.remove({
      workspaceId,
      memberIdOrEmail: member.email,
    });

    expect(await hasMembership(workspaceId, member.id)).toBe(false);
  });
});

describe("workspace access rules", () => {
  it("honours every role of a member holding several", async () => {
    const { member, workspaceId } = await seed();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member,viewer" })
      .where(eq(schema.workspaceUserTable.userId, member.id));

    await expect(
      member.client.workspace.get({ workspaceId }),
    ).resolves.toMatchObject({ id: workspaceId });
  });

  it("leaves a workspace out of the list for a role without workspace:read", async () => {
    const { member, workspaceId } = await seed();
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: JSON.stringify({}) })
      .where(
        and(
          eq(schema.workspaceRoleTable.workspaceId, workspaceId),
          eq(schema.workspaceRoleTable.role, "member"),
        ),
      );

    expect(await member.client.workspace.list()).toEqual([]);
  });

  it("answers slug availability for a workspace only to those who may rename it", async () => {
    const { owner, member, workspaceId } = await seed();
    const stranger = await signUpUser(app, "stranger@example.com");
    const ask = (client: typeof owner.client) =>
      client.workspace.slugAvailability({ slug: "alpha", workspaceId });

    await expect(ask(owner.client)).resolves.toEqual({ available: true });
    await expect(ask(member.client)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(ask(stranger.client)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("invitations", () => {
  it("records one invitation entry however often it is resent", async () => {
    const { owner, workspaceId } = await seed();
    const invite = (resend?: boolean) =>
      owner.client.members.invite({
        workspaceId,
        email: "invitee@example.com",
        role: "member",
        resend,
      });

    await invite();
    await invite(true);
    await invite(true);

    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.type, "workspace.invitation_created"));
    expect(rows).toHaveLength(1);
  });
});
