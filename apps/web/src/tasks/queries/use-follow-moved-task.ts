import { parseTicketId, ticketId, type TaskRow } from "@morrow/sync-schemas";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { orpc } from "@/app/lib/orpc";
import { useProjectsWithoutSuspense } from "@/projects";
import { useTask } from "./use-task-queries";

/**
 * Keeps a page that shows a task by Ticket id on the task when it moves to
 * another Project, here or in someone else's tab: `follow` is called with the
 * Ticket id it now has, and the caller replaces its address with it. The task
 * is found by its id while it was open, or, for an address opened cold, by
 * asking the server what the old Ticket id now means.
 *
 * Returns `missing` while the Ticket id matches no loaded task, and `gone` once
 * the server also says there is no such task.
 */
export function useFollowMovedTask({
  workspace,
  project,
  number,
  task,
  ready,
  follow,
}: {
  workspace: { id: string };
  project: { id: string; key: string };
  /** The ticket number the address names; null when none is open. */
  number: number | null;
  /** The task that number names in the Project, once loaded. */
  task: TaskRow | undefined;
  /** The lookup has finished loading, so no `task` means none is there. */
  ready: boolean;
  follow: (ticket: string) => void;
}) {
  const missing = number !== null && ready && !task;
  const ticket = number === null ? "" : ticketId(project.key, number);

  // The task this address showed, by id, so it can be found wherever it went.
  const seen = useRef({ ticket, id: "" });
  if (seen.current.ticket !== ticket) seen.current = { ticket, id: "" };
  if (task) seen.current.id = task.id;
  const moved = useTask(seen.current.id);
  const projects = useProjectsWithoutSuspense(workspace.id);
  const movedKey = projects.find((p) => p.id === moved?.projectId)?.key;

  const asked = useQuery({
    ...orpc.tasks.resolveTicket.queryOptions({
      input: {
        workspaceId: workspace.id,
        projectId: project.id,
        ticketId: ticket,
      },
    }),
    enabled: missing,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    // The task exists but is not here (yet): look again until it is.
    refetchInterval: (query) => (query.state.data ? 1000 : false),
  });

  // A task the server has not numbered yet (0) is still on its way.
  const known =
    moved && moved.number > 0 && movedKey
      ? ticketId(movedKey, moved.number)
      : undefined;
  const answered = asked.data?.ticketId;
  const destination = missing
    ? ((known !== ticket ? known : undefined) ??
      (answered && answered !== ticket ? answered : undefined))
    : undefined;

  useEffect(() => {
    if (destination && parseTicketId(destination)) follow(destination);
    // `follow` is a fresh function each render; the destination is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  return { missing, gone: missing && asked.isError };
}
