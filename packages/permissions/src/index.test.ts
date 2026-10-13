import { describe, expect, it } from "vite-plus/test";
import { createAccessControl } from "better-auth/plugins/access";
import {
  ac,
  admin,
  builtInRoles,
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
  permissionResources,
  member,
  owner,
  statement,
  viewer,
  withEmptyGrants,
} from "./index";

describe("@morrow/permissions statement surface", () => {
  it("exposes Morrow's resource statements alongside better-auth defaults", () => {
    for (const removedResource of ["project", "task", "label"]) {
      expect(statement).not.toHaveProperty(removedResource);
    }
    expect(statement.workspace).toEqual([
      "read",
      "update",
      "delete",
      "manage_settings",
    ]);
    // The organization plugin's defaults must still be present so we can
    // reuse them in member/admin/owner roles without breaking better-auth
    // checks like organization:update.
    expect(statement.organization).toBeDefined();
    expect(statement.member).toBeDefined();
  });

  it("returns the same `ac` instance for downstream consumers", () => {
    expect(ac).toBeDefined();
    expect(typeof ac.newRole).toBe("function");
  });

  it("gives every built-in role an empty grant for each Morrow resource", () => {
    expect(Object.keys(defaultRolePayloads.viewer).sort()).toEqual(
      Object.keys(statement).sort(),
    );
    for (const resource of Object.keys(permissionResources)) {
      if (resource === "workspace") continue;
      expect(defaultRolePayloads.viewer[resource]).toEqual([]);
      expect(defaultRolePayloads.admin[resource]).toEqual([]);
    }
    expect(defaultRolePayloads.viewer.workspace).toEqual(["read"]);
    expect(defaultRolePayloads.admin.workspace).toEqual([
      "read",
      "update",
      "manage_settings",
    ]);
  });

  it("adds empty grants for a future resource to a role", () => {
    const futureResources = { notes: ["read", "create"] } as const;
    const futureAccessControl = createAccessControl({
      ...statement,
      ...futureResources,
    });
    const futureViewer = futureAccessControl.newRole(
      withEmptyGrants({}, futureResources),
    );
    expect(futureViewer.statements.notes).toEqual([]);
  });
});

describe("built-in role privileges", () => {
  it("viewer can read but cannot create or modify", () => {
    expect(viewer.statements.workspace).toEqual(["read"]);
  });

  it("member can read the workspace but cannot modify it", () => {
    expect(member.statements.workspace).toEqual(["read"]);
  });

  it("admin can manage workspace settings but cannot delete the workspace", () => {
    expect(admin.statements.workspace).toContain("update");
    expect(admin.statements.workspace).toContain("manage_settings");
    expect(admin.statements.workspace).not.toContain("delete");
  });

  it("owner has every Morrow resource action including workspace:delete", () => {
    expect(owner.statements.workspace).toEqual(
      expect.arrayContaining(["read", "update", "delete", "manage_settings"]),
    );
  });

  it("groups all four roles under builtInRoles by name", () => {
    expect(Object.keys(builtInRoles).sort()).toEqual([
      "admin",
      "member",
      "owner",
      "viewer",
    ]);
    expect(builtInRoles.viewer).toBe(viewer);
    expect(builtInRoles.member).toBe(member);
    expect(builtInRoles.admin).toBe(admin);
    expect(builtInRoles.owner).toBe(owner);
  });
});

describe("default-role seed payloads", () => {
  it("names the seedable defaults but excludes owner (kept as static role)", () => {
    expect(DEFAULT_ROLE_NAMES).toEqual(["viewer", "member", "admin"]);
    expect(DEFAULT_ROLE_NAMES).not.toContain("owner");
    expect(Object.keys(defaultRolePayloads).sort()).toEqual([
      "admin",
      "member",
      "viewer",
    ]);
  });

  it("emits JSON-serializable payloads that mirror each role's compiled statements", () => {
    for (const name of DEFAULT_ROLE_NAMES) {
      const role = builtInRoles[name];
      const payload = defaultRolePayloads[name];

      // Every resource the compiled role declares must appear in the payload
      // with the same set of actions (order-insensitive). Otherwise a seeded
      // workspace_role row would silently drift from the static role.
      for (const [resource, actions] of Object.entries(role.statements)) {
        expect(payload[resource]).toBeDefined();
        expect([...payload[resource]].sort()).toEqual([...actions].sort());
      }

      // Round-trips through JSON without loss; the API stores these as text.
      const roundTripped = JSON.parse(JSON.stringify(payload));
      expect(roundTripped).toEqual(payload);
    }
  });

  it("returns a fresh mutable array per resource so callers can edit safely", () => {
    const memberPayload = defaultRolePayloads.member;
    memberPayload.workspace.push("__test_marker");
    try {
      expect(memberPayload.workspace).toContain("__test_marker");
      expect(member.statements.workspace).not.toContain("__test_marker");
    } finally {
      memberPayload.workspace.pop();
    }
  });
});
