import { createFileRoute } from "@tanstack/react-router";
import { parseTicketId } from "@morrow/sync-schemas";
import { preloadTicketTask, TaskTicketPage } from "@/tasks";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/tasks/$ticketId",
)({
  loader: ({ context, params }) => {
    const ticket = parseTicketId(params.ticketId);
    if (!ticket) return;
    // Not awaited: the page renders its frame and a skeleton while the tasks load.
    void preloadTicketTask(
      context.workspace.id,
      ticket.key,
      ticket.number,
    ).catch(() => undefined);
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { ticketId } = Route.useParams();
  return <TaskTicketPage workspace={workspace} ticketId={ticketId} />;
}
