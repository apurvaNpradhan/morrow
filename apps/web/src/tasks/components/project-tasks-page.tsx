import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Archive, FileText, Settings } from "lucide-react";
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
import { ProjectNotFound, ProjectSwitcher, useProjectByKey } from "@/projects";
import { useWorkspacePermission } from "@/workspace";
import { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { ProjectTaskViewProvider } from "./project-task-view-provider";
import { TasksSurface } from "./tasks-surface";
import { useTaskNavigation } from "./use-task-navigation";
import type { ProjectRow } from "@morrow/sync-schemas";

type ProjectTasksPageProps = {
  workspace: { id: string; slug: string };
  projectKey: string;
  layout: "board" | "list";
  /** The ticket number open in the sheet, from the address. */
  ticketNumber: number | null;
};

/**
 * A Project's tasks as a board or a list, with the toolbar, and a task open
 * in a sheet when the address names one.
 */
export function ProjectTasksPage(props: ProjectTasksPageProps) {
  const { t } = useTranslation("projects");
  const project = useProjectByKey(props.workspace.id, props.projectKey);

  if (!project) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={props.workspace.slug} />
      </WorkspaceLayout>
    );
  }
  return <LoadedProjectTasks {...props} project={project} />;
}

function LoadedProjectTasks({
  workspace,
  project,
  layout,
  ticketNumber,
}: ProjectTasksPageProps & { project: ProjectRow }) {
  const { t } = useTranslation("projects");
  const permission = useWorkspacePermission();
  const preferences = useTaskViewPreferences(project.id);
  // The layout last used is the one a Project opens in next time.
  useEffect(() => {
    if (preferences.layout !== layout) preferences.setLayout(layout);
  }, [layout, preferences]);
  const navigation = useTaskNavigation({
    workspaceSlug: workspace.slug,
    projectKey: project.key,
    layout,
  });

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
            <Button
              variant="ghost"
              size="xs"
              render={
                <Link
                  to="/$slug/projects/$key/documents"
                  params={{ slug: workspace.slug, key: project.key }}
                />
              }
            >
              <FileText aria-hidden="true" />
              <span className="max-md:sr-only">{t("board.pages")}</span>
            </Button>
            {permission.canManageProjects() ? (
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
                <span className="max-md:sr-only">{t("board.settings")}</span>
              </Button>
            ) : null}
          </>
        }
      >
        <ProjectTaskViewProvider
          workspace={workspace}
          project={project}
          openTask={navigation.openTask}
          switchLayout={navigation.switchLayout}
        >
          <div className="flex h-full min-h-0 flex-col">
            {project.archivedAt ? (
              <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                {t("board.archivedNotice")}
              </p>
            ) : null}
            <div className="min-h-0 flex-1">
              <TasksSurface
                layout={layout}
                ticketNumber={ticketNumber}
                openTask={navigation.openTask}
                closeSheet={navigation.closeSheet}
                followMoved={navigation.followMoved}
              />
            </div>
          </div>
        </ProjectTaskViewProvider>
      </WorkspaceLayout>
    </>
  );
}
