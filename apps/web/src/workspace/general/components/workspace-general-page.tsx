import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/app/settings/settings-page";
import { useAuth } from "@/auth";
import { PageTitle } from "@/design-system/page-title";
import { useActiveWorkspace } from "@/workspace/queries/use-active-workspace";
import { useWorkspacePermission } from "@/workspace/queries/use-workspace-permission";
import { OwnershipSection } from "./ownership-section";
import { useWorkspaceAutosave } from "@/workspace/general/use-workspace-autosave";
import { WorkspaceDangerZone } from "./workspace-danger-zone";
import { WorkspaceDetailsSection } from "./workspace-details-section";

export function WorkspaceGeneralPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();
  const { canManageWorkspace, canDeleteWorkspace, isOwner } =
    useWorkspacePermission();
  const canEdit = canManageWorkspace();
  const form = useWorkspaceAutosave(workspace, canEdit);

  return (
    <>
      <PageTitle title={t("settings:workspaceGeneral.pageTitle")} />
      <SettingsPage
        title={t("settings:workspaceGeneral.title")}
        description={t("settings:workspaceGeneral.subtitle")}
      >
        <WorkspaceDetailsSection
          workspace={workspace}
          form={form}
          canEdit={canEdit}
        />
        {isOwner && workspace ? (
          <OwnershipSection workspace={workspace} currentUserId={user?.id} />
        ) : null}
        {canDeleteWorkspace() && workspace ? (
          <WorkspaceDangerZone workspace={workspace} />
        ) : null}
      </SettingsPage>
    </>
  );
}
