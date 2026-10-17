import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

/** The data step of a migration: the part after its table DDL. */
function grantRolesStep(file: string) {
  const migration = readFileSync(
    resolve(__dirname, "../../apps/api/drizzle", file),
    "utf8",
  );
  return migration.slice(migration.indexOf("DO $$"));
}

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
  return JSON.parse(row!.permission);
}

describe("migration: label permissions for existing roles", () => {
  const step = grantRolesStep("0019_labels.sql");

  it("lets members create labels and admins do everything, and gives viewers none", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "viewer", { workspace: ["read"] });
    await roleRow(workspace.id, "member", { workspace: ["read"] });
    await roleRow(workspace.id, "admin", { workspace: ["read"] });

    await db.execute(sql.raw(step));

    expect(await permissionOf("viewer")).toEqual({ workspace: ["read"] });
    expect(await permissionOf("member")).toEqual({
      workspace: ["read"],
      label: ["create"],
    });
    expect(await permissionOf("admin")).toEqual({
      workspace: ["read"],
      label: ["create", "update", "delete"],
    });
  });

  it("leaves custom roles, edited grants and malformed rows alone", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "custom", { workspace: ["read"] });
    await roleRow(workspace.id, "member", { label: [] });
    await roleRow(workspace.id, "admin", "not json");

    await db.execute(sql.raw(step));

    expect(await permissionOf("custom")).toEqual({ workspace: ["read"] });
    expect(await permissionOf("member")).toEqual({ label: [] });
    const [admin] = await db
      .select({ permission: schema.workspaceRoleTable.permission })
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.role, "admin"));
    expect(admin?.permission).toBe("not json");
  });
});

describe("migration: comment permissions for existing roles", () => {
  const step = grantRolesStep("0020_comments.sql");

  it("lets every default role comment and admins moderate", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "viewer", { workspace: ["read"] });
    await roleRow(workspace.id, "member", { workspace: ["read"] });
    await roleRow(workspace.id, "admin", { workspace: ["read"] });

    await db.execute(sql.raw(step));

    expect(await permissionOf("viewer")).toEqual({
      workspace: ["read"],
      comment: ["create"],
    });
    expect(await permissionOf("member")).toEqual({
      workspace: ["read"],
      comment: ["create"],
    });
    expect(await permissionOf("admin")).toEqual({
      workspace: ["read"],
      comment: ["create", "delete"],
    });
  });

  it("leaves custom roles and edited grants alone", async () => {
    const { workspace } = await createWorkspaceMember();
    await roleRow(workspace.id, "custom", { workspace: ["read"] });
    await roleRow(workspace.id, "viewer", { comment: [] });

    await db.execute(sql.raw(step));

    expect(await permissionOf("custom")).toEqual({ workspace: ["read"] });
    expect(await permissionOf("viewer")).toEqual({ comment: [] });
  });
});
