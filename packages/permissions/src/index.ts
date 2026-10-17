import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * The permission statement. A vertical adds its resources and actions here;
 * every built-in role then gets an empty grant for them.
 */
export const permissionResources = {
  workspace: ["read", "update", "delete", "manage_settings"],
  project: ["create", "update", "delete"],
  task: ["create", "update", "delete", "assign"],
  label: ["create", "update", "delete"],
  comment: ["create", "delete"],
} as const;

/** Better Auth defaults plus Morrow's resources. */
export const statement = {
  ...defaultStatements,
  ...permissionResources,
} as const;

/** Better Auth access-control instance for the permission statement. */
export const ac = createAccessControl(statement);

type EmptyPermissionGrants<Resources> = {
  [Resource in keyof Resources]: readonly [];
};

/** Adds empty grants for every Morrow resource to a role statement. */
export function withEmptyGrants<
  const RoleStatements extends Record<string, readonly string[]>,
  const Resources extends Record<string, readonly string[]>,
>(
  roleStatements: RoleStatements,
  resources: Resources,
): RoleStatements & EmptyPermissionGrants<Resources> {
  // SAFETY: Object.fromEntries preserves runtime keys, but its string-keyed return type loses the resource literal keys.
  const emptyGrants = Object.fromEntries(
    Object.keys(resources).map((resource) => [resource, [] as const]),
  ) as EmptyPermissionGrants<Resources>;
  return { ...emptyGrants, ...roleStatements };
}

/** Read-only workspace role with Better Auth's member defaults. */
export const viewer = ac.newRole({
  ...withEmptyGrants(memberAc.statements, permissionResources),
  workspace: ["read"],
  comment: ["create"],
});

/** Default workspace role with Better Auth's member defaults. */
export const member = ac.newRole({
  ...withEmptyGrants(memberAc.statements, permissionResources),
  workspace: ["read"],
  project: ["create", "update"],
  task: ["create", "update"],
  label: ["create"],
  comment: ["create"],
});

/** Workspace administrator role with settings management, but no deletion. */
export const admin = ac.newRole({
  ...withEmptyGrants(adminAc.statements, permissionResources),
  workspace: ["read", "update", "manage_settings"],
  project: ["create", "update", "delete"],
  task: ["create", "update", "delete", "assign"],
  label: ["create", "update", "delete"],
  comment: ["create", "delete"],
});

/** Static workspace owner role with every workspace action. */
export const owner = ac.newRole({
  ...withEmptyGrants(ownerAc.statements, permissionResources),
  workspace: ["read", "update", "delete", "manage_settings"],
  project: ["create", "update", "delete"],
  task: ["create", "update", "delete", "assign"],
  label: ["create", "update", "delete"],
  comment: ["create", "delete"],
});

/** Built-in Better Auth roles available to workspace authorization. */
export const builtInRoles = { viewer, member, admin, owner } as const;

/** Names of static roles that are created as editable workspace rows. */
export const DEFAULT_ROLE_NAMES = ["viewer", "member", "admin"] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];
export type BuiltInRoleName = keyof typeof builtInRoles;

/** Copies compiled role statements into JSON-safe mutable seed payloads. */
export function createRoleSeedPayloads<
  const Roles extends Record<
    string,
    { statements: Record<string, readonly string[]> }
  >,
>(
  roles: Roles,
): {
  [RoleName in keyof Roles]: Record<string, string[]>;
} {
  // SAFETY: The outer entries use the exact input role keys; each inner entry copies that role's statement resources.
  return Object.fromEntries(
    Object.entries(roles).map(([name, role]) => [
      name,
      Object.fromEntries(
        Object.entries(role.statements).map(([resource, actions]) => [
          resource,
          [...actions],
        ]),
      ),
    ]),
  ) as { [RoleName in keyof Roles]: Record<string, string[]> };
}

/** JSON-safe seed permissions matching the compiled viewer, member, and admin roles. */
export const defaultRolePayloads: Record<
  DefaultRoleName,
  Record<string, string[]>
> = {
  ...createRoleSeedPayloads({ viewer, member, admin }),
};
