import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
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
import {
  ProjectNotFound,
  ProjectSwitcher,
  useProjectByKey,
  useProjectColumns,
} from "@/projects";
import { useLabels } from "@/labels";
import { useWorkspacePermission } from "@/workspace";
import { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { useToday } from "../queries/use-today";
import { useWorkspacePeople } from "../queries/use-workspace-people";
import { statusFractions } from "../lib/status-fraction";
import { TaskViewProvider } from "./task-view-context";
import { TasksSurface } from "./tasks-surface";
import { type TasksRoute, useTaskNavigation } from "./use-task-navigation";
import type { ProjectRow } from "@morrow/sync-schemas";

type ProjectTasksPageProps = {
  workspace: { id: string; slug: string };
  projectKey: string;
  layout: "board" | "list";
  route: TasksRoute;
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
  route,
  ticketNumber,
}: ProjectTasksPageProps & { project: ProjectRow }) {
  const { t } = useTranslation("projects");
  const permission = useWorkspacePermission();
  const columns = useProjectColumns(project.id);
  const { people, byId, meId } = useWorkspacePeople(workspace.id);
  const { labels, labelById } = useLabels(workspace.id);
  const today = useToday();
  const preferences = useTaskViewPreferences(project.id);
  // The layout last used is the one a Project opens in next time.
  useEffect(() => {
    if (preferences.layout !== layout) preferences.setLayout(layout);
  }, [layout, preferences]);
  const navigation = useTaskNavigation({
    workspaceSlug: workspace.slug,
    projectKey: project.key,
    layout,
    route,
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
                {t("board.settings")}
              </Button>
            ) : null}
          </>
        }
      >
        <TaskViewProvider
          value={{
            workspace,
            project,
            columns,
            columnById: new Map(columns.map((column) => [column.id, column])),
            statusFractions: statusFractions(columns),
            labels,
            labelById,
            people,
            personById: byId,
            meId,
            today,
            display: preferences.display,
            can: {
              create: permission.canCreateTasks(),
              edit: permission.canEditTasks(),
              delete: permission.canDeleteTasks(),
              assign: permission.canAssignTasks(),
              createLabel: permission.canCreateLabels(),
              comment: permission.canCreateComments(),
              moderateComments: permission.canDeleteComments(),
            },
            frozen: project.archivedAt !== null,
            openTask: navigation.openTask,
            switchLayout: navigation.switchLayout,
          }}
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
              />
            </div>
          </div>
        </TaskViewProvider>
      </WorkspaceLayout>
    </>
  );
}
