import { isChangeMessage } from "@tanstack/electric-db-collection";
import { workspaceMemberCollection } from "../collections/workspace-member-collection";

function hasMembership(workspaceId: string, userId: string) {
  return workspaceMemberCollection.toArray.some(
    (member) => member.workspaceId === workspaceId && member.userId === userId,
  );
}

/**
 * Waits until the user's membership in a Workspace has come back through sync,
 * after something Better Auth did (creating or joining a Workspace). Resolves
 * at once if the row is already there.
 */
export async function waitForMembership(workspaceId: string, userId: string) {
  if (hasMembership(workspaceId, userId)) return;
  await workspaceMemberCollection.utils.awaitMatch(
    (message) =>
      isChangeMessage(message) &&
      message.headers.operation === "insert" &&
      message.value.workspaceId === workspaceId &&
      message.value.userId === userId,
    5_000,
  );
}

/**
 * Waits until the user's membership has left the synced rows, after leaving or
 * deleting a Workspace. Resolves at once if it is already gone.
 */
export async function waitForMembershipGone(
  workspaceId: string,
  userId: string,
) {
  if (!hasMembership(workspaceId, userId)) return;
  await workspaceMemberCollection.utils.awaitMatch(
    (message) =>
      isChangeMessage(message) &&
      message.headers.operation === "delete" &&
      message.value.workspaceId === workspaceId &&
      message.value.userId === userId,
    5_000,
  );
}
