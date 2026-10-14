import { eq, useLiveQuery } from "@tanstack/react-db";
import { workspaceCollection } from "@/workspace";
import { myInvitationCollection } from "../collections/my-invitation-collection";
import { workspaceMemberUserCollection } from "../collections/workspace-member-user-collection";

/**
 * Pending invitations addressed to the signed-in user, with the Workspace they
 * lead to and who sent them. Expired ones are left out. Live: a new invitation
 * appears, and an accepted or cancelled one goes, without a reload.
 */
export function useMyInvitations() {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ invitation: myInvitationCollection })
        .innerJoin(
          { workspace: workspaceCollection },
          ({ invitation, workspace }) =>
            eq(invitation.workspaceId, workspace.id),
        )
        .innerJoin(
          { inviter: workspaceMemberUserCollection },
          ({ invitation, inviter }) => eq(invitation.inviterId, inviter.id),
        )
        .orderBy(({ invitation }) => invitation.createdAt, "desc")
        .select(({ invitation, workspace, inviter }) => ({
          id: invitation.id,
          workspaceId: invitation.workspaceId,
          workspaceName: workspace.name,
          inviterName: inviter.name,
          expiresAt: invitation.expiresAt,
        })),
  });

  const now = Date.now();
  return (data ?? []).filter(
    (invitation) => invitation.expiresAt.getTime() > now,
  );
}
