import { eq, sql } from "drizzle-orm";
import { config } from "#api/platform/config";
import { db } from "#api/platform/database/index";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";
import { hasInstanceAdminRole } from "#api/platform/instance-admin-role";
import { decideWorkspaceCreation } from "#api/workspace/lib/creation-policy";

/** Reads the user's current role and owned-workspace count. */
export async function getCreationState(userId: string) {
  const [user] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId));
  const [{ owned = 0 } = {}] = await db
    .select({
      owned: sql<number>`count(distinct ${workspaceUserTable.workspaceId})::int`,
    })
    .from(workspaceUserTable)
    .where(
      sql`${workspaceUserTable.userId} = ${userId} and 'owner' = ANY(string_to_array(${workspaceUserTable.role}, ','))`,
    );
  return {
    isInstanceAdmin: hasInstanceAdminRole(user?.role),
    owned,
    limit: config.maxWorkspacesPerUser,
  };
}

export async function getCreationStatus(userId: string) {
  const state = await getCreationState(userId);
  const decision = decideWorkspaceCreation(state);
  return {
    canCreate: decision.allowed,
    reason: decision.reason,
    limit: state.isInstanceAdmin ? null : state.limit,
    owned: state.owned,
  };
}
