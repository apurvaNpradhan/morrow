import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type DeleteWorkspaceRoleRequest = {
  workspaceId: string;
  roleName: string;
};

export function useDeleteWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DeleteWorkspaceRoleRequest) =>
      rpc.members.roles.remove(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
    },
  });
}
