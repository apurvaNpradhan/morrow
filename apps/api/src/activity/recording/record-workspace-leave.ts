import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";
import { recordWorkspaceActivity } from "./record-workspace-activity";

/** Records a successful Better Auth leave; its pinned leave route skips member hooks. */
export async function recordWorkspaceLeave(input: {
  workspaceId: string;
  userId: string;
}): Promise<void> {
  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, input.userId))
    .limit(1);
  if (!user) return;

  await recordWorkspaceActivity({
    type: "workspace.member_removed",
    workspaceId: input.workspaceId,
    memberId: input.userId,
    memberName: user.name,
  });
}
