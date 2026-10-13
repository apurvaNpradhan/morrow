import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

describe("workspace slug resolution", () => {
  it("hides a workspace from a role without workspace:read", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "no-read",
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "no-read",
      permission: JSON.stringify({ workspace: [] }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();
    const response = await app.request(
      `/api/workspace/by-slug/${workspace.slug}`,
    );
    expect(response.status).toBe(404);
  });
});
