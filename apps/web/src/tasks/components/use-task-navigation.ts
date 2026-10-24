import { parseTicketId, ticketId, type TaskRow } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";

/**
 * Opening a task keeps the page where it is and shows the task's own link in
 * the address bar (route masking); closing goes back to the layout without it.
 */
export function useTaskNavigation({
  workspaceSlug,
  projectKey,
  layout,
}: {
  workspaceSlug: string;
  projectKey: string;
  layout: "board" | "list";
}) {
  const navigate = useNavigate();
  const view = {
    to:
      layout === "board"
        ? ("/$slug/projects/$key/board" as const)
        : ("/$slug/projects/$key/list" as const),
    params: { slug: workspaceSlug, key: projectKey },
  };
  const taskRoute = (number: number, key = projectKey) => ({
    to: "/$slug/tasks/$ticketId" as const,
    params: { slug: workspaceSlug, ticketId: ticketId(key, number) },
  });

  return {
    openTask(task: TaskRow) {
      // A task the server has not numbered yet has no address.
      if (task.number === 0) return;
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
    /** The open task moved: the sheet shows it again under its new Ticket id, without a new Back entry. */
    followMoved(movedTicket: string) {
      const parsed = parseTicketId(movedTicket);
      if (!parsed) return;
      void navigate({
        ...view,
        params: { slug: workspaceSlug, key: parsed.key },
        search: { task: parsed.number },
        mask: taskRoute(parsed.number, parsed.key),
        replace: true,
      });
    },
    closeSheet() {
      void navigate({ ...view, search: {}, replace: true });
    },
  };
}
