import { eq, useLiveQuery } from "@tanstack/react-db";
import { useAuth } from "@/auth";
import { workspaceMemberCollection } from "@/members";
import { workspaceCollection } from "../collections/workspace-collection";
import type { MyWorkspace } from "./my-workspaces";

/** The user's Workspaces with their role in each, live. Empty until sync has loaded. */
export function useMyWorkspaces(): MyWorkspace[] {
  const { user } = useAuth();
  const userId = user?.id;

  const { data } = useLiveQuery({
    query: (q) => {
      if (!userId) return undefined;
      return q
        .from({ workspace: workspaceCollection })
        .innerJoin(
          { member: workspaceMemberCollection },
          ({ workspace, member }) => eq(member.workspaceId, workspace.id),
        )
        .where(({ member }) => eq(member.userId, userId))
        .orderBy(({ workspace }) => workspace.createdAt, "asc")
        .orderBy(({ workspace }) => workspace.id, "asc")
        .select(({ workspace, member }) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          logo: workspace.logo,
          description: workspace.description,
          createdAt: workspace.createdAt,
          role: member.role,
        }));
    },
  });

  return data ?? [];
}
