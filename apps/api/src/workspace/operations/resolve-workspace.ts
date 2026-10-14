import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import {
  workspaceSlugAliasTable,
  workspaceTable,
  workspaceUserTable,
} from "#api/platform/database/schema";
import { roleHasWorkspacePermission } from "#api/platform/permissions";
import { getWorkspace } from "./get-workspace";

/**
 * Resolves a live slug, then a former slug, to a workspace the user can open.
 * A workspace the user can't access looks exactly like one that doesn't exist.
 */
export async function resolveWorkspace(userId: string, slug: string) {
  const [live] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.slug, slug))
    .limit(1);
  const [alias] = live
    ? []
    : await db
        .select({ workspaceId: workspaceSlugAliasTable.workspaceId })
        .from(workspaceSlugAliasTable)
        .where(eq(workspaceSlugAliasTable.slug, slug))
        .limit(1);
  const workspaceId = live?.id ?? alias?.workspaceId;
  const notFound = new ORPCError("NOT_FOUND", {
    message: "Workspace not found",
  });
  if (!workspaceId) throw notFound;

  // Membership with read access is the only way in. Instance admins reach
  // other people's workspaces through the administration pages, not this URL.
  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  if (
    !member ||
    !(await roleHasWorkspacePermission(workspaceId, member.role, {
      workspace: ["read"],
    }))
  ) {
    throw notFound;
  }

  return getWorkspace(workspaceId);
}
