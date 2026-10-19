import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/app/settings/settings-page";
import { cn } from "@/design-system/cn";
import { PageTitle } from "@/design-system/page-title";
import { ProjectNotFound } from "../components/project-not-found";
import { useProjectByKey } from "../queries/use-projects";
import type { ProjectRow } from "@morrow/sync-schemas";

type Tab = "general" | "workflow" | "fields";

type ProjectSettingsFrameProps = {
  workspace: { id: string; slug: string };
  projectKey: string;
  tab: Tab;
  title: string;
  /** Receives the project once it is known. */
  children: (project: ProjectRow) => ReactNode;
  actions?: ReactNode;
};

/** What both project settings pages share: the project lookup, title and the three tabs. */
export function ProjectSettingsFrame({
  workspace,
  projectKey,
  tab,
  title,
  children,
  actions,
}: ProjectSettingsFrameProps) {
  const { t } = useTranslation("projects");
  const project = useProjectByKey(workspace.id, projectKey);

  if (!project) return <ProjectNotFound slug={workspace.slug} />;

  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      active && "bg-background text-foreground shadow-xs",
    );

  return (
    <>
      <PageTitle title={`${title} · ${project.name}`} />
      <SettingsPage title={project.name} description={title} actions={actions}>
        <nav
          aria-label={t("settings.tabsLabel")}
          className="inline-flex rounded-lg border bg-muted/40 p-0.5"
        >
          <Link
            to="/$slug/settings/projects/$key/general"
            params={{ slug: workspace.slug, key: project.key }}
            aria-current={tab === "general" ? "page" : undefined}
            className={linkClass(tab === "general")}
          >
            {t("settings.general")}
          </Link>
          <Link
            to="/$slug/settings/projects/$key/workflow"
            params={{ slug: workspace.slug, key: project.key }}
            aria-current={tab === "workflow" ? "page" : undefined}
            className={linkClass(tab === "workflow")}
          >
            {t("settings.workflow")}
          </Link>
          <Link
            to="/$slug/settings/projects/$key/fields"
            params={{ slug: workspace.slug, key: project.key }}
            aria-current={tab === "fields" ? "page" : undefined}
            className={linkClass(tab === "fields")}
          >
            {t("settings.fields")}
          </Link>
        </nav>
        {project.archivedAt ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("settings.archivedNotice")}
          </p>
        ) : null}
        {children(project)}
      </SettingsPage>
    </>
  );
}
