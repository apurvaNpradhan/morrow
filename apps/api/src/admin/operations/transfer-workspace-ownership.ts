import { and, eq, inArray } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";
import { isOwnerRole } from "#api/members/index";
import { lockWorkspace } from "#api/members/index";
import { listWorkspaceMembers } from "./list-workspace-members";

export async function transferWorkspaceOwnership(request: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = request;

  const ownerSnapshot = await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const target = members.find((candidate) => candidate.userId === userId);
    if (!target) {
      throw new ORPCError("NOT_FOUND", { message: "Member not found" });
    }
    const otherOwners = members
      .filter((candidate) => isOwnerRole(candidate.role))
      .map((owner) => owner.userId)
      .filter((ownerId) => ownerId !== userId);
    if (isOwnerRole(target.role) && otherOwners.length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "This member is already the workspace owner",
      });
    }
    const [owner] = await tx
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!owner)
      throw new ORPCError("NOT_FOUND", { message: "Member not found" });

    if (otherOwners.length > 0) {
      await tx
        .update(workspaceUserTable)
        .set({ role: "admin" })
        .where(
          and(
            eq(workspaceUserTable.workspaceId, workspaceId),
            inArray(workspaceUserTable.userId, otherOwners),
          ),
        );
    }
    await tx
      .update(workspaceUserTable)
      .set({ role: "owner" })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    return owner;
  });

  await recordWorkspaceActivity({
    type: "workspace.ownership_transferred",
    workspaceId,
    ownerId: userId,
    ownerName: ownerSnapshot.name,
  });

  return listWorkspaceMembers(workspaceId);
}
