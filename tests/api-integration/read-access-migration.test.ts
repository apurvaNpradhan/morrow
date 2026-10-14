import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const migration = readFileSync(
  resolve(__dirname, "../../apps/api/drizzle/0012_roles_always_read.sql"),
  "utf8",
);

beforeEach(resetTestDatabase);

async function roleRow(workspaceId: string, role: string, permission: unknown) {
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId,
    role,
    permission:
      typeof permission === "string" ? permission : JSON.stringify(permission),
  });
}

async function permissionOf(role: string) {
  const [row] = await db
    .select({ permission: schema.workspaceRoleTable.permission })
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.role, role));
  return JSON.parse(row.permission);
}

describe("migration: every role can read its workspace", () => {
  it("adds read to roles without it and leaves the rest alone", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "no-workspace", { member: ["update"] });
    await roleRow(workspace.id, "no-read", {
      workspace: ["update"],
      ac: ["create"],
    });
    await roleRow(workspace.id, "has-read", { workspace: ["read", "update"] });

    await db.execute(sql.raw(migration));

    expect(await permissionOf("no-workspace")).toEqual({
      member: ["update"],
      workspace: ["read"],
    });
    expect(await permissionOf("no-read")).toEqual({
      workspace: ["update", "read"],
      ac: ["create"],
    });
    expect(await permissionOf("has-read")).toEqual({
      workspace: ["read", "update"],
    });
  });
});
