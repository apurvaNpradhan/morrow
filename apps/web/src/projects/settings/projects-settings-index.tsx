import { Navigate } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsEmpty } from "@/app/settings/settings-empty";
import { SettingsPage } from "@/app/settings/settings-page";
import { PageTitle } from "@/design-system/page-title";
import { useProjects } from "../queries/use-projects";

/** `/settings/projects`: opens the first project's settings, or says there are none. */
export function ProjectsSettingsIndex({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("projects");
  const projects = useProjects(workspace.id);
  const first = projects.find((project) => !project.archivedAt) ?? projects[0];

  if (first) {
    return (
      <Navigate
        to="/$slug/settings/projects/$key/general"
        params={{ slug: workspace.slug, key: first.key }}
        replace
      />
    );
  }

  return (
    <>
      <PageTitle title={t("pageTitle")} />
      <SettingsPage title={t("pageTitle")}>
        <SettingsCard>
          <SettingsEmpty
            icon={<FolderKanban />}
            title={t("settings.noProjectsTitle")}
            description={t("settings.noProjectsDescription")}
          />
        </SettingsCard>
      </SettingsPage>
    </>
  );
}
