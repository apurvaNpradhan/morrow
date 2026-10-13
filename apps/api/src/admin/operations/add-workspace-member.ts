import { eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";
import { isAssignableWorkspaceRole } from "#api/admin/lib/is-assignable-workspace-role";
import { lockWorkspace } from "#api/members/index";
import { listWorkspaceMembers } from "./list-workspace-members";

export async function addWorkspaceMember(request: {
  workspaceId: string;
  userId: string;
  role: string;
}) {
  const { workspaceId, userId, role } = request;

  const memberSnapshot = await db.transaction(async (tx) => {
    const members = await lockWorkspace(tx, workspaceId);
    const [user] = await tx
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!user) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }
    if (members.some((member) => member.userId === userId)) {
      throw new ORPCError("CONFLICT", {
        message: "This user is already a member of the workspace",
      });
    }
    if (!(await isAssignableWorkspaceRole(tx, workspaceId, role))) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Unknown role. To make someone the owner, add them and then transfer ownership",
      });
    }

    const inserted = await tx
      .insert(workspaceUserTable)
      .values({ workspaceId, userId, role, joinedAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: workspaceUserTable.id });
    if (inserted.length === 0) {
      throw new ORPCError("CONFLICT", {
        message: "This user is already a member of the workspace",
      });
    }
    return user;
  });

  await recordWorkspaceActivity({
    type: "workspace.member_joined",
    workspaceId,
    memberId: memberSnapshot.id,
    memberName: memberSnapshot.name,
  });

  return listWorkspaceMembers(workspaceId);
}
