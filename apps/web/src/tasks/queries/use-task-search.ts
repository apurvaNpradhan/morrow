import type { ColumnCategory } from "@morrow/sync-schemas";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";
import { useDebouncedValue } from "@/design-system/use-debounced-value";
import { useTicketLookup } from "./use-ticket-lookup";

/** A task a picker can offer. */
export type TaskHit = {
  id: string;
  projectId: string;
  ticketId: string;
  title: string;
  category: ColumnCategory;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 150;

/**
 * The Workspace's tasks matching what was typed, from the same server search
 * as the search dialog, with the task a typed ticket id names first.
 */
export function useTaskSearch(workspaceId: string, text: string): TaskHit[] {
  const settled = useDebouncedValue(text, DEBOUNCE_MS);
  const remote = useQuery({
    ...orpc.search.query.queryOptions({ input: { workspaceId, q: settled } }),
    enabled: settled.length >= MIN_QUERY_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const ticket = useTicketLookup(workspaceId, text);

  const hits: TaskHit[] = (
    settled.length >= MIN_QUERY_LENGTH ? (remote.data?.tasks ?? []) : []
  ).map((hit) => ({
    id: hit.id,
    projectId: hit.projectId,
    ticketId: hit.ticketId,
    title: hit.title,
    category: hit.category as ColumnCategory,
  }));
  if (!ticket || hits.some((hit) => hit.id === ticket.task.id)) return hits;
  return [
    {
      id: ticket.task.id,
      projectId: ticket.task.projectId,
      ticketId: `${ticket.projectKey}-${ticket.task.number}`,
      title: ticket.task.title,
      category: "unstarted",
    },
    ...hits,
  ];
}
