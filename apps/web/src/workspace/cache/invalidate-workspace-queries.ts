import type { QueryClient } from "@tanstack/react-query";
import { WORKSPACE_BY_SLUG_KEY } from "@/workspace/routing/workspace-by-slug-query";

/** Refreshes every cached view of a workspace's own details (name, logo). */
export function invalidateWorkspaceDetails(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
    queryClient.invalidateQueries({ queryKey: WORKSPACE_BY_SLUG_KEY }),
    queryClient.invalidateQueries({ queryKey: ["active-organization"] }),
  ]);
}
