import type { RouterOutputs } from "@/app/lib/router-types";

export type WorkspaceUser =
  RouterOutputs["workspace"]["full"]["members"][number];

export type WorkspaceUserInvitation =
  RouterOutputs["workspace"]["full"]["invitations"][number];

export type UserInvitation =
  RouterOutputs["members"]["pendingInvitations"][number];
