import { ticketId, type TaskRow } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";

/** Which route is showing the page: it decides how opening and closing a task navigate. */
export type TasksRoute = "board" | "list" | "task";

/**
 * Opening a task keeps the page where it is and shows the task's own link in
 * the address bar (route masking); closing goes back to the layout without it.
 * On the task's own route, opening another task only changes the ticket.
 */
export function useTaskNavigation({
  workspaceSlug,
  projectKey,
  layout,
  route,
}: {
  workspaceSlug: string;
  projectKey: string;
  layout: "board" | "list";
  route: TasksRoute;
}) {
  const navigate = useNavigate();
  const view = {
    to:
      layout === "board"
        ? ("/$slug/projects/$key/board" as const)
        : ("/$slug/projects/$key/list" as const),
    params: { slug: workspaceSlug, key: projectKey },
  };
  const taskRoute = (number: number) => ({
    to: "/$slug/tasks/$ticketId" as const,
    params: { slug: workspaceSlug, ticketId: ticketId(projectKey, number) },
  });

  return {
    openTask(task: TaskRow) {
      // A task the server has not numbered yet has no address.
      if (task.number === 0) return;
      if (route === "task") {
        void navigate({ ...taskRoute(task.number), replace: true });
        return;
      }
      void navigate({
        ...view,
        search: { task: task.number },
        mask: taskRoute(task.number),
      });
    },
    switchLayout(next: "board" | "list") {
      void navigate({
        to:
          next === "board"
            ? "/$slug/projects/$key/board"
            : "/$slug/projects/$key/list",
        params: { slug: workspaceSlug, key: projectKey },
      });
    },
    closeSheet() {
      void navigate({ ...view, search: {}, replace: true });
    },
  };
}
