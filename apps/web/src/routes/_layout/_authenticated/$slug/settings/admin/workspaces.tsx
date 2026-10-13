import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WorkspaceManagementPanel } from "@/admin";
import { PageTitle } from "@/design-system/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/admin/workspaces",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminWorkspaces.title")} />
      <WorkspaceManagementPanel />
    </>
  );
}
