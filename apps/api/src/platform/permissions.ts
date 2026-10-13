import { type BuiltInRoleName, builtInRoles } from "@morrow/permissions";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { db, schema } from "./database";
import { hasInstanceAdminRole } from "./instance-admin-role";

type PermissionMap = Record<string, string[]>;

function builtInRoleStatements(
  role: string,
): Record<string, readonly string[]> | null {
  if (role in builtInRoles) {
    return builtInRoles[role as BuiltInRoleName].statements as Record<
      string,
      readonly string[]
    >;
  }
  return null;
}

function parsePermissionStatements(
  raw: string,
): Record<string, readonly string[]> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  // Only keep entries shaped like { [resource: string]: string[] }.
  // Anything malformed is dropped so `satisfies()` never calls
  // `.includes()` on a non-array.
  const result: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!Array.isArray(actions)) continue;
    const filtered = actions.filter(
      (action): action is string => typeof action === "string",
    );
    if (filtered.length > 0) {
      result[resource] = filtered;
    }
  }
  return result;
}

async function customRoleStatements(
  workspaceId: string,
  role: string,
  database: Pick<typeof db, "select"> = db,
): Promise<Record<string, readonly string[]> | null> {
  const [row] = await database
    .select({ permission: schema.workspaceRoleTable.permission })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        eq(schema.workspaceRoleTable.role, role),
      ),
    )
    .limit(1);

  if (!row?.permission) return null;

  return parsePermissionStatements(row.permission);
}

function satisfies(
  statements: Record<string, readonly string[]>,
  required: PermissionMap,
): boolean {
  for (const [resource, actions] of Object.entries(required)) {
    const granted = statements[resource];
    if (!granted) return false;
    for (const action of actions) {
      if (!granted.includes(action)) return false;
    }
  }
  return true;
}

/**
 * Whether any of the roles grants the permissions. Better Auth stores several
 * roles of one member as a comma-separated string ("member,viewer") and grants
 * what any one of them grants, so this does the same.
 */
export async function roleHasWorkspacePermission(
  workspaceId: string,
  role: string,
  permissions: PermissionMap,
  database: Pick<typeof db, "select"> = db,
) {
  for (const single of role.split(",")) {
    const name = single.trim();
    if (!name) continue;
    // Prefer the DB row when present so admin-edited defaults
    // (viewer/member/admin) take effect immediately. Falls back to the
    // compiled-in static definitions only when no row exists, which protects
    // those roles from a 403 if their workspace somehow missed the seed.
    const statements =
      (await customRoleStatements(workspaceId, name, database)) ??
      builtInRoleStatements(name);
    if (statements && satisfies(statements, permissions)) return true;
  }
  return false;
}

/** The role-based check without a request: used by Hono and oRPC alike. */
export async function userHasWorkspacePermission(
  userId: string,
  workspaceId: string,
  permissions: PermissionMap,
  instanceAdmin: boolean,
) {
  if (instanceAdmin) return true;

  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (!member?.role) return false;
  return roleHasWorkspacePermission(workspaceId, member.role, permissions);
}

/** The request's user role when known, otherwise the stored one. */
async function isInstanceAdmin(c: Context): Promise<boolean> {
  const user = c.get("user") as { role?: string | null } | null | undefined;
  if (user?.role) return hasInstanceAdminRole(user.role);

  const userId = c.get("userId");
  if (!userId) return false;

  const [row] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  return hasInstanceAdminRole(row?.role);
}

export async function hasWorkspacePermission(
  c: Context,
  permissions: PermissionMap,
  // Checks a workspace other than the one the request authorized against.
  // Needed when a single request touches two workspaces (e.g. moving a
  // project), since the access middleware only resolves one.
  workspaceIdOverride?: string,
) {
  const workspaceId = workspaceIdOverride ?? c.get("workspaceId");
  const userId = c.get("userId");
  if (!workspaceId) return false;
  if (await isInstanceAdmin(c)) return true;
  if (!userId) return false;
  return userHasWorkspacePermission(userId, workspaceId, permissions, false);
}
