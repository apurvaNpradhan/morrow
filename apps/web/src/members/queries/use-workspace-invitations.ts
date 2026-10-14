import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { workspaceInvitationCollection } from "../collections/workspace-invitation-collection";

/**
 * Pending invitations of one Workspace, newest first, live. The route loader
 * preloads the collection, so this never waits.
 */
export function useWorkspaceInvitations(workspaceId: string) {
  return useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ invitation: workspaceInvitationCollection })
        .where(({ invitation }) => eq(invitation.workspaceId, workspaceId))
        .orderBy(({ invitation }) => invitation.createdAt, "desc")
        .orderBy(({ invitation }) => invitation.id, "asc"),
  }).data;
}
