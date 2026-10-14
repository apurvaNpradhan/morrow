import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { queryClient } from "@/app/query-client";

type DeleteWorkspaceUserRequest = {
  workspaceId: string;
  userId: string;
};

export function useDeleteWorkspaceUser() {
  return useMutation({
    mutationFn: ({ workspaceId, userId }: DeleteWorkspaceUserRequest) =>
      rpc.members.remove({ workspaceId, memberIdOrEmail: userId }),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });
    },
  });
}
