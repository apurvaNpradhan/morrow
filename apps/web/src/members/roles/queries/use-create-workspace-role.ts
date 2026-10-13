import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type CreateWorkspaceRoleRequest = {
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
};

export function useCreateWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateWorkspaceRoleRequest) =>
      rpc.members.roles.create(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
    },
  });
}
