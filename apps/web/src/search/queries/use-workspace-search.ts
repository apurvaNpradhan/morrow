import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";

/** The server search needs this many characters. */
export const MIN_SERVER_QUERY_LENGTH = 2;

/**
 * Tasks and comments of the Workspace matching `q`. The previous results stay
 * until the next ones arrive, and a request that is no longer wanted is
 * cancelled (oRPC passes the query's abort signal on).
 */
export function useWorkspaceSearch(workspaceId: string, q: string) {
  return useQuery({
    ...orpc.search.query.queryOptions({ input: { workspaceId, q } }),
    enabled: q.length >= MIN_SERVER_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
