import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";

/** Refetches whenever `enabled` turns on, so the count is current when shown. */
export function useWorkspaceCreationStatus(enabled: boolean) {
  return useQuery({
    ...orpc.workspace.creationStatus.queryOptions({ input: undefined }),
    enabled,
  });
}
