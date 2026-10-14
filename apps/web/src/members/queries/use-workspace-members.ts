import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { workspaceMemberCollection } from "../collections/workspace-member-collection";
import { workspaceMemberUserCollection } from "../collections/workspace-member-user-collection";

/**
 * The members of one Workspace with their users, oldest first. The route
 * loader preloads both collections, so this never waits; it re-renders when a
 * member joins, leaves or changes role, in any tab.
 */
export function useWorkspaceMembers(workspaceId: string) {
  return useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ member: workspaceMemberCollection })
        .innerJoin(
          { user: workspaceMemberUserCollection },
          ({ member, user }) => eq(member.userId, user.id),
        )
        .where(({ member }) => eq(member.workspaceId, workspaceId))
        .orderBy(({ member }) => member.joinedAt, "asc")
        .orderBy(({ member }) => member.id, "asc")
        .select(({ member, user }) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          },
        })),
  }).data;
}
