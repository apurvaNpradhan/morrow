import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { queryClient } from "@/app/query-client";

type CancelInvitationRequest = {
  invitationId: string;
  workspaceId: string;
};

export function useCancelInvitation() {
  return useMutation({
    mutationFn: ({ invitationId }: CancelInvitationRequest) =>
      rpc.members.cancelInvitation({ invitationId }),
    onSuccess: (_, { workspaceId }) => {
      // Invalidate all workspace-related queries
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      // Also invalidate the broader workspace query
      queryClient.invalidateQueries({
        queryKey: ["workspace"],
      });
    },
  });
}
