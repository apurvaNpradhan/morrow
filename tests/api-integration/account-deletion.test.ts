import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { deleteAccountData } from "../../apps/api/src/account";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function addMember(workspaceId: string, role: string) {
  const userId = `user-${randomUUID()}`;

  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Other Member",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });

  return user;
}

describe("API integration: account deletion", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("deletes a workspace the account is the only member of", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));

    expect(workspaces).toHaveLength(0);
  });

  it("leaves a shared workspace that keeps another owner", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await addMember(owner.workspace.id, "owner");

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));
    const members = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, owner.user.id));

    expect(workspaces).toHaveLength(1);
    expect(members).toHaveLength(0);
  });
});
