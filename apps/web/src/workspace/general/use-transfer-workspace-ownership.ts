import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type TransferOwnershipRequest = {
  workspaceId: string;
  newOwnerMemberId: string;
  currentOwnerMemberId: string;
};

// The API promotes the new owner first and then demotes the old one, so the
// workspace never has no owner. Better Auth has no single transfer call.
export function useTransferWorkspaceOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TransferOwnershipRequest) =>
      rpc.members.transferOwnership(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-user", "active"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-capabilities", variables.workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["active-organization"] });
    },
  });
}
