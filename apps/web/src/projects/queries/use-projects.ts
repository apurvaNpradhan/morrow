import { comparePosition, type ProjectRow } from "@morrow/sync-schemas";
import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import { projectCollection } from "../collections/project-collection";

/*
 * Projects and columns are sorted here, not in the query: positions are
 * fractional-index keys that only sort correctly by bytes, and the query
 * engine may compare strings by locale.
 */

/** A workspace's projects in their shared order, archived ones included. */
export function useProjects(workspaceId: string): ProjectRow[] {
  const { data } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ project: projectCollection })
        .where(({ project }) => eq(project.workspaceId, workspaceId)),
  });
  return [...data].sort(comparePosition);
}

/**
 * Like `useProjects`, for chrome outside the pages (sidebar, switcher): it
 * never suspends, and is empty until sync has delivered, or without a workspace.
 */
export function useProjectsWithoutSuspense(
  workspaceId: string | undefined,
): ProjectRow[] {
  const { data } = useLiveQuery({
    query: (q) => {
      if (!workspaceId) return undefined;
      return q
        .from({ project: projectCollection })
        .where(({ project }) => eq(project.workspaceId, workspaceId));
    },
  });
  return [...(data ?? [])].sort(comparePosition);
}

/** The project with this key (any case), or undefined. */
export function useProjectByKey(workspaceId: string, key: string) {
  const projects = useProjects(workspaceId);
  const wanted = key.toUpperCase();
  return projects.find((project) => project.key === wanted);
}
