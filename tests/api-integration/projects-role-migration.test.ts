import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

/** The data step of the projects migration: the part after the table DDL. */
const migration = readFileSync(
  resolve(__dirname, "../../apps/api/drizzle/0014_projects_and_columns.sql"),
  "utf8",
);
const grantRolesStep = migration.slice(migration.indexOf("DO $$"));

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

describe("migration: project permissions for existing roles", () => {
  it("gives the default member and admin roles their project grants", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "member", { workspace: ["read"] });
    await roleRow(workspace.id, "admin", {
      workspace: ["read", "update"],
      ac: ["create"],
    });
    await roleRow(workspace.id, "viewer", { workspace: ["read"] });

    await db.execute(sql.raw(grantRolesStep));

    expect(await permissionOf("member")).toEqual({
      workspace: ["read"],
      project: ["create", "update"],
    });
    expect(await permissionOf("admin")).toEqual({
      workspace: ["read", "update"],
      ac: ["create"],
      project: ["create", "update", "delete"],
    });
    expect(await permissionOf("viewer")).toEqual({
      workspace: ["read"],
    });
  });

  it("leaves custom roles, edited project grants and malformed rows alone", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "custom", { workspace: ["read"] });
    await roleRow(workspace.id, "member", {
      workspace: ["read"],
      project: ["update"],
    });
    await roleRow(workspace.id, "admin", "not json");

    await db.execute(sql.raw(grantRolesStep));

    expect(await permissionOf("custom")).toEqual({
      workspace: ["read"],
    });
    expect(await permissionOf("member")).toEqual({
      workspace: ["read"],
      project: ["update"],
    });
    const [admin] = await db
      .select({ permission: schema.workspaceRoleTable.permission })
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.role, "admin"));
    expect(admin?.permission).toBe("not json");
  });
});
