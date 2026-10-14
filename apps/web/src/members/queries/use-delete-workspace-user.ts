import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type DeleteWorkspaceUserRequest = {
  workspaceId: string;
  userId: string;
};

export function useDeleteWorkspaceUser() {
  return useMutation({
    // The member row leaves the synced collection by itself.
    mutationFn: ({ workspaceId, userId }: DeleteWorkspaceUserRequest) =>
      rpc.members.remove({ workspaceId, memberIdOrEmail: userId }),
  });
}
