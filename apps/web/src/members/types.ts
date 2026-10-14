import type { RouterOutputs } from "@/app/lib/router-types";

/** A member of a Workspace joined with their user, as the synced collections give it. */
export type WorkspaceUser = {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: { id: string; name: string; email: string; image: string | null };
};

export type WorkspaceUserInvitation =
  RouterOutputs["workspace"]["full"]["invitations"][number];

export type UserInvitation =
  RouterOutputs["members"]["pendingInvitations"][number];
