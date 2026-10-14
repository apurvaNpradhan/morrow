import type { WorkspaceRow } from "@morrow/sync-schemas";
import { workspaceMemberCollection } from "@/members";
import { workspaceCollection } from "../collections/workspace-collection";

/** A Workspace the user belongs to, with their role in it. */
export type MyWorkspace = WorkspaceRow & { role: string };

/**
 * The user's Workspaces, oldest first, read straight from the synced
 * collections. For route loaders, which run after the collections are
 * preloaded; components use `useMyWorkspaces`.
 */
export function listMyWorkspaces(userId: string): MyWorkspace[] {
  const roles = new Map(
    workspaceMemberCollection.toArray
      .filter((member) => member.userId === userId)
      .map((member) => [member.workspaceId, member.role]),
  );
  return workspaceCollection.toArray
    .flatMap((workspace) => {
      const role = roles.get(workspace.id);
      return role === undefined ? [] : [{ ...workspace, role }];
    })
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
}
