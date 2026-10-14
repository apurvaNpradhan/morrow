import { useTranslation } from "react-i18next";
import { useMyInvitations } from "@/members";
import { getSegmentCount } from "@/onboarding/lib/segment-count";
import { CreateWorkspaceForm } from "./create-workspace-form";
import { InvitationCardList } from "./invitation-card-list";
import { OnboardingShell } from "./onboarding-shell";
import { useJoinInvitation } from "@/onboarding/use-join-invitation";

type CreatedWorkspace = { id: string; slug: string; name: string };

type WorkspaceStepProps = {
  /** Without progress, for someone who left their last workspace. */
  standalone?: boolean;
  onBack?: () => void;
  onCreated: (workspace: CreatedWorkspace) => void | Promise<void>;
  onJoined: (slug: string) => void | Promise<void>;
};

/** Join a workspace you were invited to, or create one. */
export function WorkspaceStep({
  standalone = false,
  onBack,
  onCreated,
  onJoined,
}: WorkspaceStepProps) {
  const { t } = useTranslation();
  const invitations = useMyInvitations();
  const { join, joiningId } = useJoinInvitation(onJoined);
  const hasInvitations = invitations.length > 0;
  const path = joiningId ? "join" : "create";

  return (
    <OnboardingShell
      title={t("auth:onboarding.workspace.title")}
      subtitle={
        hasInvitations
          ? t("auth:onboarding.workspace.subtitleInvited")
          : t("auth:onboarding.workspace.subtitle")
      }
      segments={standalone ? 0 : getSegmentCount(path)}
      current={2}
      onBack={onBack}
    >
      <div className="space-y-6">
        {hasInvitations ? (
          <InvitationCardList
            invitations={invitations}
            joiningId={joiningId}
            onJoin={join}
          />
        ) : null}

        <div className="space-y-4">
          {hasInvitations ? (
            <p className="text-sm text-muted-foreground">
              {t("auth:onboarding.workspace.orCreate")}
            </p>
          ) : null}
          <CreateWorkspaceForm
            autoFocus={!hasInvitations}
            onCreated={onCreated}
          />
        </div>
      </div>
    </OnboardingShell>
  );
}
