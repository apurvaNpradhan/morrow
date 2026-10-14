import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { acceptInvitation, InvitationAcceptedError } from "@/members";
import { toast } from "@/design-system/toast";
import { errorMessage } from "@/app/lib/error-message";

/** Accepts an invitation from the Workspace step and hands back the joined workspace's slug. */
export function useJoinInvitation(
  onJoined: (slug: string) => void | Promise<void>,
) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const join = async (invitationId: string) => {
    setJoiningId(invitationId);
    try {
      const { slug } = await acceptInvitation(invitationId, user?.id ?? "");
      await onJoined(slug);
    } catch (error) {
      setJoiningId(null);
      if (error instanceof InvitationAcceptedError) {
        // Joined, so the invitation is gone from the list; retrying would fail.
        toast.error(t("auth:invitation.toast.acceptedOpenFailed"));
        return;
      }
      toast.error(
        errorMessage(t, error, t("auth:onboarding.workspace.joinFailed")),
      );
    }
  };

  return { join, joiningId };
}
