import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { track } from "@/app/analytics/track";
import { detailCode } from "@/app/lib/orpc-error";
import { rpc } from "@/app/lib/orpc";
import { queryClient } from "@/app/query-client";

type InviteWorkspaceUserRequest = {
  workspaceId: string;
  email: string;
  role: string;
  resend?: boolean;
};

export function useInviteWorkspaceUser() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (request: InviteWorkspaceUserRequest) => {
      try {
        return await rpc.members.invite(request);
      } catch (error) {
        if (detailCode(error) === "INVITATION_EMAIL_FAILED") {
          throw new Error(t("settings:invitationEmailFailed"));
        }
        throw error;
      }
    },
    onSuccess: (_data, { resend }) => {
      if (!resend) track("Invite Sent");
    },
    onSettled: (_, _error, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });
    },
  });
}
