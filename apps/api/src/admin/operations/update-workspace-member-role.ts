import { and, eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";
import { isOwnerRole } from "#api/members/index";
import { isAssignableWorkspaceRole } from "#api/admin/lib/is-assignable-workspace-role";
import { lockWorkspace } from "#api/members/index";
import { listWorkspaceMembers } from "./list-workspace-members";

export async function updateWorkspaceMemberRole(request: {
  workspaceId: string;
  userId: string;
  role: string;
}) {
  const { workspaceId, userId, role } = request;

  const roleChange = await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new ORPCError("NOT_FOUND", { message: "Member not found" });
    }
    if (!(await isAssignableWorkspaceRole(tx, workspaceId, role))) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Unknown role. Use the ownership transfer to make someone the owner",
      });
    }
    if (member.role === role) return null;
    const [user] = await tx
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!user)
      throw new ORPCError("NOT_FOUND", { message: "Member not found" });
    const owners = members.filter((candidate) => isOwnerRole(candidate.role));
    if (isOwnerRole(member.role) && owners.length === 1) {
      throw new ORPCError("CONFLICT", {
        message:
          "Transfer ownership to another member before changing the only owner's role",
      });
    }

    await tx
      .update(workspaceUserTable)
      .set({ role })
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      );
    return { memberName: user.name, previousRole: member.role, role };
  });

  if (roleChange) {
    await recordWorkspaceActivity({
      type: "workspace.member_role_changed",
      workspaceId,
      memberId: userId,
      memberName: roleChange.memberName,
      previousRole: roleChange.previousRole,
      role: roleChange.role,
    });
  }

  return listWorkspaceMembers(workspaceId);
}
