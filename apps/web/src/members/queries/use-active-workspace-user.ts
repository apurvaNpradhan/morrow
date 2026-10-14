import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useAuth } from "@/auth";
import { useActiveWorkspace } from "@/workspace";
import { workspaceMemberCollection } from "../collections/workspace-member-collection";

/** The signed-in user's own membership in the active Workspace, live. */
export const useGetActiveWorkspaceUser = () => {
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const userId = user?.id;

  const { data } = useLiveQuery({
    query: (q) => {
      if (!workspaceId || !userId) return undefined;
      return q
        .from({ member: workspaceMemberCollection })
        .where(({ member }) =>
          and(eq(member.workspaceId, workspaceId), eq(member.userId, userId)),
        )
        .findOne();
    },
  });

  return { data };
};
