import { type OrganizationOptions } from "better-auth/plugins/organization";
import { recordWorkspaceActivity } from "#api/activity/index";

/** Membership lifecycle: activity events. */
export const memberHooks = {
  // Only a new invitation reaches this hook; a resend does not.
  afterCreateInvitation: async ({ invitation, organization }) => {
    await recordWorkspaceActivity({
      type: "workspace.invitation_created",
      workspaceId: organization.id,
      invitationId: invitation.id,
      role: invitation.role ?? null,
    });
  },
  afterRemoveMember: async ({ member, user }) => {
    if (member?.organizationId) {
      await recordWorkspaceActivity({
        type: "workspace.member_removed",
        workspaceId: member.organizationId,
        memberId: member.userId,
        memberName: user.name,
      });
    }
  },
  // Better Auth calls afterAddMember for workspace creators and regular
  // additions; invitation acceptance uses afterAcceptInvitation instead.
  afterAddMember: async ({ member, user, organization }) => {
    await recordWorkspaceActivity({
      type: "workspace.member_joined",
      workspaceId: organization.id,
      memberId: member.userId,
      memberName: user.name,
    });
  },
  afterAcceptInvitation: async ({ member, user, organization }) => {
    await recordWorkspaceActivity({
      type: "workspace.member_joined",
      workspaceId: organization.id,
      memberId: member.userId,
      memberName: user.name,
    });
  },
  afterUpdateMemberRole: async ({
    member,
    previousRole,
    user,
    organization,
  }) => {
    if (member.role === previousRole) return;
    if (member.role === "owner" && previousRole !== "owner") {
      await recordWorkspaceActivity({
        type: "workspace.ownership_transferred",
        workspaceId: organization.id,
        ownerId: member.userId,
        ownerName: user.name,
      });
      return;
    }
    await recordWorkspaceActivity({
      type: "workspace.member_role_changed",
      workspaceId: organization.id,
      memberId: member.userId,
      memberName: user.name,
      previousRole,
      role: member.role,
    });
  },
  afterCancelInvitation: async ({ invitation, organization }) => {
    if (!invitation) return;
    await recordWorkspaceActivity({
      type: "workspace.invitation_revoked",
      workspaceId: organization.id,
      invitationId: invitation.id,
    });
  },
} satisfies NonNullable<OrganizationOptions["organizationHooks"]>;
