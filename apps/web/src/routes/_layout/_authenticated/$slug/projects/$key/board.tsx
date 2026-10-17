import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProjectTasksPage, preloadProjectTasks } from "@/tasks";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/projects/$key/board",
)({
  // Opening a task keeps this page and puts the number here; the address bar
  // shows the task's own link instead.
  validateSearch: z.object({ task: z.number().int().positive().optional() }),
  // Not awaited: the page renders its frame and a skeleton while the tasks load.
  loader: ({ context, params }) => {
    void preloadProjectTasks(context.workspace.id, params.key).catch(
      () => undefined,
    );
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  const { task } = Route.useSearch();
  return (
    <ProjectTasksPage
      workspace={workspace}
      projectKey={key}
      layout="board"
      ticketNumber={task ?? null}
    />
  );
}
