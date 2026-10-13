import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db, schema } from "./database";
import { hasInstanceAdminRole } from "./instance-admin-role";

export async function validateWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  if (hasInstanceAdminRole(user?.role)) {
    return;
  }

  const membership = await db
    .select()
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, userId),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    // Same answer as a workspace that does not exist, so strangers cannot
    // probe which workspace ids exist.
    throw new ORPCError("NOT_FOUND", {
      message: "Workspace not found",
    });
  }
}
