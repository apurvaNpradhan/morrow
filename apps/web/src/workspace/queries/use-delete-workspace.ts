import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { useAuth } from "@/auth";
import { waitForMembershipGone } from "@/members";

type DeleteWorkspaceRequest = {
  workspaceId: string;
};

export function useDeleteWorkspace() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ workspaceId }: DeleteWorkspaceRequest) => {
      const result = await rpc.workspace.remove({ workspaceId });
      // The membership goes with the workspace; once it has left the synced
      // rows nothing here points at the deleted workspace any more.
      await waitForMembershipGone(workspaceId, user?.id ?? "");
      return result;
    },
  });
}
