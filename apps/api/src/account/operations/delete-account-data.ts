import { APIError } from "better-auth/api";
import { and, eq, inArray } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { db } from "#api/platform/database/index";
import { eventContext } from "#api/platform/event-context";
import { ownedImageKey, queueStorageCleanup } from "#api/storage/index";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "#api/platform/database/schema";
import { queueAvatarCleanup } from "./queue-avatar-cleanup";
import {
  formatBlockedWorkspacesMessage,
  hasOwnerRole,
  planAccountDeletion,
  type WorkspaceMembershipSummary,
} from "./account-deletion";
import { logFailure } from "#api/platform/logger";

async function collectMemberships(
  userId: string,
): Promise<WorkspaceMembershipSummary[]> {
  const memberships = await db
    .select({
      workspaceId: workspaceUserTable.workspaceId,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId));

  if (memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map((membership) => membership.workspaceId);

  const members = await db
    .select({
      workspaceId: workspaceUserTable.workspaceId,
      workspaceName: workspaceTable.name,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceUserTable.workspaceId, workspaceTable.id),
    )
    .where(inArray(workspaceUserTable.workspaceId, workspaceIds));

  return memberships.map((membership) => {
    const workspaceMembers = members.filter(
      (member) => member.workspaceId === membership.workspaceId,
    );

    return {
      workspaceId: membership.workspaceId,
      workspaceName: workspaceMembers[0]?.workspaceName ?? "workspace",
      isOwner: hasOwnerRole(membership.role),
      memberCount: workspaceMembers.length,
      ownerCount: workspaceMembers.filter((member) => hasOwnerRole(member.role))
        .length,
    };
  });
}

export async function deleteAccountData(userId: string) {
  const [account] = await db
    .select({ name: userTable.name, image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const plan = planAccountDeletion(await collectMemberships(userId));

  if (plan.blockedWorkspaceNames.length > 0) {
    throw new APIError("CONFLICT", {
      message: formatBlockedWorkspacesMessage(plan.blockedWorkspaceNames),
    });
  }

  // The user row is about to go; the stored picture must follow.
  await queueAvatarCleanup(userId, account?.image);

  if (plan.workspaceIdsToDelete.length > 0) {
    // A direct delete skips Better Auth's delete hook, so queue the logos here.
    const logos = await db
      .select({ id: workspaceTable.id, logo: workspaceTable.logo })
      .from(workspaceTable)
      .where(inArray(workspaceTable.id, plan.workspaceIdsToDelete));
    const logoKeys = logos.flatMap(({ id, logo }) => {
      const key = ownedImageKey(logo, "workspace-logos", id);
      return key ? [key] : [];
    });
    await db
      .delete(workspaceTable)
      .where(inArray(workspaceTable.id, plan.workspaceIdsToDelete));
    if (logoKeys.length > 0) {
      await queueStorageCleanup(db, logoKeys).catch(() => {
        logFailure("account.queue-logo-cleanup");
      });
    }
  }

  if (plan.workspaceIdsToLeave.length > 0) {
    await db
      .delete(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.userId, userId),
          inArray(workspaceUserTable.workspaceId, plan.workspaceIdsToLeave),
        ),
      );
    if (account) {
      // The leaver is the actor, even when an administrator removes the account.
      await eventContext.run({ actorUserId: userId }, () =>
        Promise.all(
          plan.workspaceIdsToLeave.map((workspaceId) =>
            recordWorkspaceActivity({
              type: "workspace.member_removed",
              workspaceId,
              memberId: userId,
              memberName: account.name,
            }),
          ),
        ),
      );
    }
  }

  return plan;
}
