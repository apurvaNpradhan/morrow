import { parseTicketId, type TaskRow } from "@morrow/sync-schemas";
import { useProjectsWithoutSuspense } from "@/projects";
import { useTicketTask } from "./use-task-queries";

/**
 * Resolves what the command palette's search names as a ticket id (`MOR-12`)
 * to a task of this Workspace, loading it on demand. Undefined for anything
 * else, or while it loads, or when there is no such task.
 */
export function useTicketLookup(
  workspaceId: string | undefined,
  query: string,
): { task: TaskRow; projectKey: string } | undefined {
  const projects = useProjectsWithoutSuspense(workspaceId);
  const ticket = parseTicketId(query);
  const project = ticket
    ? projects.find((candidate) => candidate.key === ticket.key)
    : undefined;
  const { task } = useTicketTask(
    project?.id ?? "",
    project ? ticket!.number : null,
  );
  return project && task ? { task, projectKey: project.key } : undefined;
}
