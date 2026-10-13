import { asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "#api/platform/database/schema";

export async function listWorkspaceMembers(workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) {
    throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
  }

  const rows = await db
    .select({
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
      joinedAt: workspaceUserTable.joinedAt,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceUserTable.joinedAt), asc(userTable.id));

  return rows.map((row) => ({
    ...row,
    joinedAt: row.joinedAt.toISOString(),
  }));
}
