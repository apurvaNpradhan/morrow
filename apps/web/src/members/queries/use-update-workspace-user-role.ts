import { workspaceMemberCollection } from "../collections/workspace-member-collection";

/**
 * Changes a member's role. The new role shows at once and rolls back if the
 * server rejects it; resolves when the change has come back through sync.
 */
export async function updateWorkspaceUserRole(memberId: string, role: string) {
  const transaction = workspaceMemberCollection.update(memberId, (draft) => {
    draft.role = role;
  });
  await transaction.isPersisted.promise;
}
