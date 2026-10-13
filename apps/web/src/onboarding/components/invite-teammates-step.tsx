import { useTranslation } from "react-i18next";
import { InviteStep } from "./invite-step";
import { OnboardingShell } from "./onboarding-shell";

type InviteTeammatesStepProps = {
  workspaceId: string;
  workspaceName: string;
  onDone: () => void | Promise<void>;
};

/** The optional last step after creating a workspace. */
export function InviteTeammatesStep({
  workspaceId,
  workspaceName,
  onDone,
}: InviteTeammatesStepProps) {
  const { t } = useTranslation();
  return (
    <OnboardingShell
      title={t("auth:onboarding.invite.title")}
      subtitle={t("auth:onboarding.invite.subtitle", { name: workspaceName })}
      segments={3}
      current={3}
    >
      <InviteStep workspaceId={workspaceId} onDone={onDone} />
    </OnboardingShell>
  );
}
