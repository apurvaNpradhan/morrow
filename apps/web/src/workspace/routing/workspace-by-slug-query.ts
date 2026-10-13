import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { ORPCError } from "@orpc/client";
import { rpc } from "@/app/lib/orpc";

export const WORKSPACE_BY_SLUG_KEY = ["workspace", "by-slug"] as const;

/** The workspace behind a URL slug. A former slug resolves to the canonical workspace. */
export function workspaceBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: [...WORKSPACE_BY_SLUG_KEY, slug],
    queryFn: () => rpc.workspace.resolve({ slug }),
    staleTime: 30_000,
    // Typed answers (not found, forbidden) will not change on a retry.
    retry: (count, error) => count < 2 && !(error instanceof ORPCError),
  });
}

/** Drops idle slug lookups and refetches the ones on screen, after a rename. */
export async function refreshSlugLookups(queryClient: QueryClient) {
  queryClient.removeQueries({
    queryKey: WORKSPACE_BY_SLUG_KEY,
    type: "inactive",
  });
  await queryClient.invalidateQueries({ queryKey: WORKSPACE_BY_SLUG_KEY });
}
