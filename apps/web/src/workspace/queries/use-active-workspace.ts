import { useMatch } from "@tanstack/react-router";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { workspaceCollection } from "../collections/workspace-collection";

/**
 * The workspace named by the `/$slug` URL, live. The route resolves the slug
 * once and keeps the workspace's id, so a rename elsewhere keeps this tab on
 * the same workspace.
 */
export function useActiveWorkspace() {
  const match = useMatch({
    from: "/_layout/_authenticated/$slug",
    shouldThrow: false,
  });
  const workspaceId = match?.context.workspace.id;

  const { data } = useLiveQuery({
    query: (q) => {
      if (!workspaceId) return undefined;
      return q
        .from({ workspace: workspaceCollection })
        .where(({ workspace }) => eq(workspace.id, workspaceId))
        .findOne();
    },
  });

  return {
    data,
    error: null,
    isLoading: false,
    isError: false,
  };
}
