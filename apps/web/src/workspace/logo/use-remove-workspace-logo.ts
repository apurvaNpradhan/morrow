import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { invalidateWorkspaceDetails } from "@/workspace/cache/invalidate-workspace-queries";

export function useRemoveWorkspaceLogo(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => rpc.workspace.removeLogo({ workspaceId }),
    onSuccess: () => invalidateWorkspaceDetails(queryClient),
  });
}
