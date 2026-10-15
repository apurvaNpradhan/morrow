import { parseTicketId } from "@morrow/sync-schemas";
import { useRouterState } from "@tanstack/react-router";

/**
 * The key of the Project the user is looking at, from the address: a Project's
 * board or list (`/<workspace>/projects/MOR/board`) or one of its tasks
 * (`/<workspace>/tasks/MOR-12`). Undefined anywhere else.
 */
export function useCurrentProjectKey() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return projectKeyOfPath(pathname);
}

export function projectKeyOfPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[1] === "projects" && segments[2]) {
    return segments[2].toUpperCase();
  }
  if (segments[1] === "tasks" && segments[2]) {
    return parseTicketId(segments[2])?.key;
  }
  return undefined;
}
