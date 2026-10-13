import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type UpdateWorkspaceRequest = {
  workspaceId: string;
  name?: string;
  description?: string;
};

export function useUpdateWorkspace() {
  return useMutation({
    mutationFn: (request: UpdateWorkspaceRequest) =>
      rpc.workspace.update(request),
  });
}
