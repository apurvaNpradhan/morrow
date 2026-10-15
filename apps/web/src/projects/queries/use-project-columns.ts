import { compareColumns, type ProjectColumnRow } from "@morrow/sync-schemas";
import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import { projectColumnCollection } from "../collections/project-column-collection";

/** A project's columns in board order: by category, then by position. */
export function useProjectColumns(projectId: string): ProjectColumnRow[] {
  const { data } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ column: projectColumnCollection })
        .where(({ column }) => eq(column.projectId, projectId)),
  });
  return [...data].sort(compareColumns);
}

/**
 * Like `useProjectColumns`, for dialogs outside the pages: it never suspends,
 * and is empty until sync has delivered, or without a project.
 */
export function useProjectColumnsWithoutSuspense(
  projectId: string | undefined,
): ProjectColumnRow[] {
  const { data } = useLiveQuery({
    query: (q) =>
      projectId
        ? q
            .from({ column: projectColumnCollection })
            .where(({ column }) => eq(column.projectId, projectId))
        : undefined,
  });
  return [...(data ?? [])].sort(compareColumns);
}
