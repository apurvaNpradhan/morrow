import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserManagementPanel } from "@/admin";
import { PageTitle } from "@/design-system/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/admin/users",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminUsers.title")} />
      <UserManagementPanel />
    </>
  );
}
