import { ticketId } from "@morrow/sync-schemas";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useGoBack } from "@/app/navigation/use-go-back";
import { useLeaveSettingsOnEscape } from "@/app/settings/nav/use-leave-settings-on-escape";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/design-system/ui/breadcrumb";
import { Skeleton } from "@/design-system/ui/skeleton";
import { ProjectIcon, ProjectNotFound, useProjectByKey } from "@/projects";
import type { ProjectRow } from "@morrow/sync-schemas";
import { useTaskCommands } from "../actions/use-task-commands";
import { useTaskFieldHotkeys } from "./use-task-field-hotkeys";
import { displayTicketId } from "../lib/task-links";
import { useFollowMovedTask } from "../queries/use-follow-moved-task";
import { useTicketTask } from "../queries/use-task-queries";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { DueDateDialog } from "./due-date-dialog";
import { MoveTasksDialog } from "./move-tasks-dialog";
import { ProjectTaskViewProvider } from "./project-task-view-provider";
import { SelectionBar } from "./selection-bar";
import { TaskDetails } from "./task-details";
import { TaskFieldPicker } from "./task-field-picker";
import { TaskPager } from "./task-pager";
import { TaskHeaderActions } from "./task-header-actions";

type Workspace = { id: string; slug: string };

/**
 * A task on its own page, `/<workspace>/tasks/MOR-12`: the same details as the
 * sheet. Esc or the back control returns to the page it was opened from, or to
 * the Project's board when there is none.
 */
export function TaskPage({
  workspace,
  projectKey,
  number,
}: {
  workspace: Workspace;
  projectKey: string;
  number: number;
}) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const project = useProjectByKey(workspace.id, projectKey);

  if (!project) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }
  return (
    <ProjectTaskViewProvider
      workspace={workspace}
      project={project}
      openTask={(task) =>
        void navigate({
          to: "/$slug/tasks/$ticketId",
          params: {
            slug: workspace.slug,
            ticketId: ticketId(project.key, task.number),
          },
        })
      }
      switchLayout={(layout) =>
        void navigate({
          to:
            layout === "board"
              ? "/$slug/projects/$key/board"
              : "/$slug/projects/$key/list",
          params: { slug: workspace.slug, key: project.key },
        })
      }
    >
      <LoadedTaskPage workspace={workspace} project={project} number={number} />
    </ProjectTaskViewProvider>
  );
}

function LoadedTaskPage({
  workspace,
  project,
  number,
}: {
  workspace: Workspace;
  project: ProjectRow;
  number: number;
}) {
  const { t } = useTranslation("tasks");
  const navigate = useNavigate();
  const router = useRouter();
  const goBack = useGoBack(workspace);
  const { task, isReady } = useTicketTask(project.id, number);
  const ticket = displayTicketId(project.key, number);
  // Moved to another Project (here or elsewhere): the address follows it.
  const { gone } = useFollowMovedTask({
    workspace,
    project,
    number,
    task,
    ready: isReady,
    follow: (moved) =>
      void navigate({
        to: "/$slug/tasks/$ticketId",
        params: { slug: workspace.slug, ticketId: moved },
        replace: true,
      }),
  });

  // Nothing recorded (a reload, a pasted link): step back in the app's own
  // history, else go Home. The task's project board is not where you were.
  function leave() {
    goBack(() => {
      if (router.history.canGoBack()) router.history.back();
      else void navigate({ to: "/$slug", params: { slug: workspace.slug } });
    });
  }
  useLeaveSettingsOnEscape(leave);
  useTaskCommands();
  useTaskFieldHotkeys();

  return (
    <WorkspaceLayout
      title={ticket}
      crumbs={
        <>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link
                  to="/$slug/projects/$key/board"
                  params={{ slug: workspace.slug, key: project.key }}
                />
              }
            >
              <span className="flex items-center gap-1.5 text-xs font-normal text-card-foreground">
                <ProjectIcon project={project} className="size-3.5" />
                {project.name}
              </span>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="font-mono text-xs">{ticket}</span>
          </BreadcrumbItem>
        </>
      }
      headerActions={
        task ? (
          <>
            <TaskPager task={task} />
            <TaskHeaderActions task={task} fullPage />
          </>
        ) : null
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {task ? (
          <TaskDetails key={task.id} task={task} fullPage />
        ) : gone ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("sheet.notFound", { key: project.key, number })}
          </p>
        ) : (
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
      <SelectionBar />
      <TaskFieldPicker />
      <DueDateDialog />
      <MoveTasksDialog />
      <DeleteTaskDialog onDeleted={leave} />
    </WorkspaceLayout>
  );
}
