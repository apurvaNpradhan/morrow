import { rpc } from "@/app/lib/orpc";
import { waitForRow } from "@/app/sync/wait-for-row";
import { workspaceCollection } from "@/workspace";
import { setActiveWorkspace } from "@/workspace";
import { workspaceMemberCollection } from "../../collections/workspace-member-collection";
import { waitForMembership } from "../../lib/wait-for-membership";

/** The invitation was accepted, but the joined workspace could not be opened. */
export class InvitationAcceptedError extends Error {
  constructor() {
    super("Invitation accepted, but the workspace could not be opened");
    this.name = "InvitationAcceptedError";
  }
}

/**
 * Accepts an invitation and makes its workspace the last-used one. Returns the
 * workspace's slug, which is what the app's URLs are built from. Resolves once
 * the new membership has come back through sync, so the page that opens next
 * finds the workspace.
 */
export async function acceptInvitation(invitationId: string, userId: string) {
  // The invitation page sits outside the signed-in layout, so nothing has
  // started the sync yet; it has to run to see the membership arrive.
  await Promise.all([
    workspaceCollection.preload(),
    workspaceMemberCollection.preload(),
  ]);
  const accepted = await rpc.members.acceptInvitation({ invitationId });
  const workspaceId = accepted?.invitation.organizationId;
  if (!workspaceId) throw new Error("Failed to accept invitation");

  // The invitation is used up from here on: nothing below may make the caller
  // report the accept as failed, and a retry would fail.
  await setActiveWorkspace(workspaceId).catch(() => {});
  try {
    await waitForMembership(workspaceId, userId);
    // The pending invitation had delivered the workspace row, and the row
    // leaves with it before the membership brings it back.
    const workspace = await waitForRow(workspaceCollection, workspaceId);
    return { workspaceId, slug: workspace.slug };
  } catch {
    throw new InvitationAcceptedError();
  }
}
