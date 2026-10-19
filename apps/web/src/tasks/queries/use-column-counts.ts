import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";

/**
 * How many unarchived tasks each Column of the Project holds, counted on the
 * server: tasks sync on demand, so counting them in the browser would load
 * every row. Refreshed now and then rather than live.
 */
export function useColumnCounts(workspaceId: string, projectId: string) {
  return useQuery({
    ...orpc.tasks.columnCounts.queryOptions({
      input: { workspaceId, projectId },
    }),
    refetchInterval: 30_000,
  }).data;
}
