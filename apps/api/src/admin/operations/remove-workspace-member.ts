import { and, eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";
import { isOwnerRole } from "#api/members/index";
import { lockWorkspace } from "#api/members/index";
import { listWorkspaceMembers } from "./list-workspace-members";

export async function removeWorkspaceMember(request: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = request;

  const removedMember = await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new ORPCError("NOT_FOUND", { message: "Member not found" });
    }
    const owners = members.filter((candidate) => isOwnerRole(candidate.role));
    if (isOwnerRole(member.role) && owners.length === 1) {
      throw new ORPCError("CONFLICT", {
        message:
          "Transfer ownership to another member before removing the only owner",
      });
    }

    const [user] = await tx
      .select({ name: userTable.name, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    await tx
      .delete(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    return user;
  });

  if (removedMember)
    await recordWorkspaceActivity({
      type: "workspace.member_removed",
      workspaceId,
      memberId: userId,
      memberName: removedMember.name,
    });
  return listWorkspaceMembers(workspaceId);
}
