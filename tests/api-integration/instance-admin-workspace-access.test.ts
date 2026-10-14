import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { validateWorkspaceAccess } from "../../apps/api/src/platform/validate-workspace-access";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { createTestClient } from "./helpers/orpc";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function createUser(role: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: "Outsider",
      role,
    })
    .returning();
  return user;
}

describe("API integration: instance admin workspace access", () => {
  it("does not open a workspace the admin never joined through its URL", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const admin = await createUser("user,admin");
    mockAuthenticatedSession(admin);
    const client = createTestClient(createApp().app);

    await expect(
      client.workspace.resolve({ slug: owner.workspace.slug }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lets a multi-role instance admin into a workspace they never joined", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const admin = await createUser("user,admin");

    await expect(
      validateWorkspaceAccess(admin.id, owner.workspace.id),
    ).resolves.toBeUndefined();
  });

  it("still rejects a plain user who is not a member", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const outsider = await createUser("user");

    await expect(
      validateWorkspaceAccess(outsider.id, owner.workspace.id),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
