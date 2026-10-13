import { DEFAULT_ROLE_NAMES, statement } from "@morrow/permissions";
import type { WorkspaceRole } from "./queries/use-workspace-roles";

// Default roles are seeded per workspace by the API (see
// `seedDefaultWorkspaceRoles` and the afterCreateOrganization hook). They show
// up in `customRoles` like any other dynamic role but get a "Default" badge,
// can't be deleted, and reserve their names against new custom roles. Owner
// stays a static role on the auth side and is hidden from this UI, but its
// name is still reserved here.
const DEFAULT_ROLE_NAME_SET = new Set<string>(DEFAULT_ROLE_NAMES);
export const RESERVED_ROLE_NAMES = [...DEFAULT_ROLE_NAMES, "owner"];
export const ASSEMBLED_STATEMENT = statement as Record<
  string,
  readonly string[]
>;

export const DEFAULT_ROLE_DESCRIPTIONS = new Map(
  Object.entries({
    viewer: "Read access to the workspace.",
    member: "Read access to the workspace.",
    admin: "Manage workspace settings and members.",
  } satisfies Record<string, string>),
);

export function isDefaultRole(name: string) {
  return DEFAULT_ROLE_NAME_SET.has(name);
}

export function permissionsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const arrA = [...(a[key] ?? [])].sort();
    const arrB = [...(b[key] ?? [])].sort();
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (arrA[i] !== arrB[i]) return false;
    }
  }
  return true;
}

export function permissionCount(
  permissions: Record<string, string[] | undefined>,
) {
  return Object.values(permissions).reduce(
    (sum, actions) => sum + (actions?.length ?? 0),
    0,
  );
}

/** Defaults (viewer/member/admin) first so they anchor the list, then user-created roles in their natural order. */
export function sortRoles(roles: WorkspaceRole[]): WorkspaceRole[] {
  const defaults: WorkspaceRole[] = [];
  const custom: WorkspaceRole[] = [];
  for (const role of roles) {
    if (isDefaultRole(role.role)) defaults.push(role);
    else custom.push(role);
  }
  defaults.sort(
    (a, b) =>
      DEFAULT_ROLE_NAMES.indexOf(a.role as never) -
      DEFAULT_ROLE_NAMES.indexOf(b.role as never),
  );
  return [...defaults, ...custom];
}
