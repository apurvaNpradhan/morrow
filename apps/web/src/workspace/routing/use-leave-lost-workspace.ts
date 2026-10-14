import { eq, useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/auth";
import { workspaceMemberCollection } from "@/members";

/**
 * Watches the user's own membership rows. When one disappears (removed, left,
 * or the Workspace was deleted) it drops the oRPC queries that still mention
 * that Workspace and, if the tab is on it, goes back to the start page. The
 * synced rows go by themselves; this covers what is cached outside sync.
 */
export function useLeaveLostWorkspace() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const match = useMatch({
    from: "/_layout/_authenticated/$slug",
    shouldThrow: false,
  });
  const openWorkspaceId = match?.context.workspace.id;
  const known = useRef<Set<string> | null>(null);

  const { data } = useLiveQuery({
    query: (q) => {
      if (!userId) return undefined;
      return q
        .from({ member: workspaceMemberCollection })
        .where(({ member }) => eq(member.userId, userId));
    },
  });

  useEffect(() => {
    // Signing out clears the collection: that is not losing a Workspace.
    if (!data || workspaceMemberCollection.status !== "ready") {
      known.current = null;
      return;
    }
    const current = new Set(data.map((member) => member.workspaceId));
    const before = known.current;
    known.current = current;
    if (!before) return;

    for (const workspaceId of before) {
      if (current.has(workspaceId)) continue;
      queryClient.removeQueries({
        predicate: (query) =>
          JSON.stringify(query.queryKey).includes(workspaceId),
      });
      if (workspaceId === openWorkspaceId) {
        void navigate({ to: "/", replace: true });
      }
    }
  }, [data, openWorkspaceId, queryClient, navigate]);
}
