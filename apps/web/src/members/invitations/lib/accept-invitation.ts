import { rpc } from "@/app/lib/orpc";
import { setActiveWorkspace } from "@/workspace";

/** The invitation was accepted, but the joined workspace could not be looked up. */
export class InvitationAcceptedError extends Error {
  constructor() {
    super("Invitation accepted, but the workspace could not be opened");
    this.name = "InvitationAcceptedError";
  }
}

/**
 * Accepts an invitation and makes its workspace the last-used one. Returns the
 * workspace's slug, which is what the app's URLs are built from.
 */
export async function acceptInvitation(invitationId: string) {
  const accepted = await rpc.members.acceptInvitation({ invitationId });
  const workspaceId = accepted?.invitation.organizationId;
  if (!workspaceId) throw new Error("Failed to accept invitation");

  // The invitation is used up from here on: nothing below may make the caller
  // report the accept as failed, and a retry would fail.
  await setActiveWorkspace(workspaceId).catch(() => {});
  try {
    const workspace = await rpc.workspace.get({ workspaceId });
    return { workspaceId, slug: workspace.slug };
  } catch {
    throw new InvitationAcceptedError();
  }
}
