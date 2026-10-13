import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type DeleteWorkspaceRequest = {
  workspaceId: string;
};

export function useDeleteWorkspace() {
  return useMutation({
    mutationFn: ({ workspaceId }: DeleteWorkspaceRequest) =>
      rpc.workspace.remove({ workspaceId }),
  });
}
