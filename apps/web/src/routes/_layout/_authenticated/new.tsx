import { workspaceUrl } from "@morrow/permissions/workspace-url";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CreateWorkspaceForm } from "@/onboarding";
import { OnboardingShell } from "@/onboarding";
import { setActiveWorkspace } from "@/workspace";
import { toast } from "@/design-system/toast";

export const Route = createFileRoute("/_layout/_authenticated/new")({
  component: NewWorkspace,
});

function NewWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <OnboardingShell
      title={t("workspace:create.heading")}
      subtitle={t("workspace:create.subtitle")}
      segments={0}
      current={0}
      onBack={() => navigate({ to: "/" })}
    >
      <CreateWorkspaceForm
        onCreated={async (workspace) => {
          toast.success(t("workspace:create.success"));
          await setActiveWorkspace(workspace.id);
          await navigate({
            to: workspaceUrl(workspace.slug) as never,
            replace: true,
          });
        }}
      />
    </OnboardingShell>
  );
}
