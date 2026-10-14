import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { waitForInvitation } from "../../lib/wait-for-invitation";

type CancelInvitationRequest = {
  invitationId: string;
  workspaceId: string;
};

export function useCancelInvitation() {
  return useMutation({
    mutationFn: async ({ invitationId }: CancelInvitationRequest) => {
      const result = await rpc.members.cancelInvitation({ invitationId });
      await waitForInvitation(invitationId, "cancelled");
      return result;
    },
  });
}
