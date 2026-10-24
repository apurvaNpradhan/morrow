import { parseTicketId, type TaskEvent } from "@morrow/sync-schemas";
import { useQueries } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";
import { useProjectsWithoutSuspense } from "@/projects";

/** The ticket ids a history entry names, as they were written. */
export function ticketsNamedBy(event: TaskEvent): string[] {
  switch (event.type) {
    case "duplicated":
      return [event.data.sourceTicketId];
    case "parent":
      return [event.data.from, event.data.to].filter((id) => id !== null);
    case "subtask_added":
    case "subtask_removed":
    case "relation_added":
    case "relation_removed":
      return [event.data.ticketId];
    default:
      return [];
  }
}

/**
 * The Ticket id each of these now answers to. History writes the id a task had
 * at the time; a task that has moved since is shown under its current id. An
 * id that does not resolve (the task is gone) stays as written.
 */
export function useLiveTickets(
  workspaceId: string,
  tickets: readonly string[],
) {
  const projects = useProjectsWithoutSuspense(workspaceId);
  const answers = useQueries({
    queries: tickets.map((ticket) => {
      const key = parseTicketId(ticket)?.key;
      const project = projects.find((candidate) => candidate.key === key);
      return {
        ...orpc.tasks.resolveTicket.queryOptions({
          input: {
            workspaceId,
            projectId: project?.id ?? "",
            ticketId: ticket,
          },
        }),
        enabled: project !== undefined,
        retry: false,
        staleTime: 5 * 60_000,
      };
    }),
  });
  const live = new Map(
    tickets.map((ticket, index) => [ticket, answers[index]?.data?.ticketId]),
  );
  return (ticket: string) => live.get(ticket) ?? ticket;
}
