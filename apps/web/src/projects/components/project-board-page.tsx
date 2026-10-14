import { Link } from "@tanstack/react-router";
import { Archive, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { PageTitle } from "@/design-system/page-title";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/design-system/ui/breadcrumb";
import { useWorkspacePermission } from "@/workspace";
import { useProjectColumns } from "../queries/use-project-columns";
import { useProjectByKey } from "../queries/use-projects";
import { ProjectBoard } from "./project-board";
import { ProjectNotFound } from "./project-not-found";
import { ProjectSwitcher } from "./project-switcher";

type ProjectBoardPageProps = {
  workspace: { id: string; slug: string };
  projectKey: string;
};

export function ProjectBoardPage({
  workspace,
  projectKey,
}: ProjectBoardPageProps) {
  const { t } = useTranslation("projects");
  const project = useProjectByKey(workspace.id, projectKey);

  if (!project) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }

  return <LoadedBoardPage workspace={workspace} project={project} />;
}

function LoadedBoardPage({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: NonNullable<ReturnType<typeof useProjectByKey>>;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects } = useWorkspacePermission();
  const columns = useProjectColumns(project.id);

  return (
    <>
      <PageTitle title={project.name} />
      <WorkspaceLayout
        title={project.name}
        crumbs={
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link
                    to="/$slug/projects"
                    params={{ slug: workspace.slug }}
                  />
                }
              >
                <span className="text-xs font-normal text-card-foreground">
                  {t("pageTitle")}
                </span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <ProjectSwitcher workspace={workspace} current={project} />
            </BreadcrumbItem>
          </>
        }
        headerActions={
          <>
            {project.archivedAt ? (
              <Badge variant="outline" className="gap-1">
                <Archive aria-hidden="true" className="size-3" />
                {t("list.archived")}
              </Badge>
            ) : null}
            {canManageProjects() ? (
              <Button
                variant="ghost"
                size="xs"
                render={
                  <Link
                    to="/$slug/settings/projects/$key/general"
                    params={{ slug: workspace.slug, key: project.key }}
                  />
                }
              >
                <Settings aria-hidden="true" />
                {t("board.settings")}
              </Button>
            ) : null}
          </>
        }
      >
        {project.archivedAt ? (
          <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            {t("board.archivedNotice")}
          </p>
        ) : null}
        <ProjectBoard project={project} columns={columns} />
      </WorkspaceLayout>
    </>
  );
}
