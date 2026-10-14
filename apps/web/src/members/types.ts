import type { InvitationRow, UserRow } from "@morrow/sync-schemas";

/** A member of a Workspace joined with their user, as the synced collections give it. */
export type WorkspaceUser = {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: UserRow;
};

/** A pending invitation of a Workspace, as the members page lists it. */
export type WorkspaceUserInvitation = InvitationRow;

/** A pending invitation addressed to the signed-in user. */
export type UserInvitation = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: Date;
};
