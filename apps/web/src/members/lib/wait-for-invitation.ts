import { isChangeMessage } from "@tanstack/electric-db-collection";
import { workspaceInvitationCollection } from "../collections/workspace-invitation-collection";

/**
 * Waits until an invitation Better Auth just created or cancelled has come
 * back through sync, so the list is already right when the caller reports
 * success. Best effort: the change is made either way, and the list catches up
 * by itself if the echo is slow.
 */
export async function waitForInvitation(
  invitationId: string,
  change: "created" | "cancelled",
) {
  const present = workspaceInvitationCollection.has(invitationId);
  if (change === "created" ? present : !present) return;
  await workspaceInvitationCollection.utils
    .awaitMatch(
      (message) =>
        isChangeMessage(message) &&
        message.value.id === invitationId &&
        message.headers.operation ===
          (change === "created" ? "insert" : "delete"),
      5_000,
    )
    .catch(() => undefined);
}
