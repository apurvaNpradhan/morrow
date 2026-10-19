import { comparePosition, type ProjectFieldRow } from "@morrow/sync-schemas";
import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { projectFieldCollection } from "../collections/project-field-collection";

/** A Field with its options in order, as every view reads them. */
export function ordered(field: ProjectFieldRow): ProjectFieldRow {
  return { ...field, options: [...field.options].sort(comparePosition) };
}

/** A project's Fields in Field order, each with its options in order. */
export function useProjectFields(projectId: string): ProjectFieldRow[] {
  const { data } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ field: projectFieldCollection })
        .where(({ field }) => eq(field.projectId, projectId)),
  });
  // Memoised: the task views list these in dependency arrays of their sorts.
  return useMemo(() => [...data].sort(comparePosition).map(ordered), [data]);
}

/**
 * Like `useProjectFields`, for dialogs outside the pages: it never suspends,
 * and is empty until sync has delivered, or without a project.
 */
export function useProjectFieldsWithoutSuspense(
  projectId: string | undefined,
): ProjectFieldRow[] {
  const { data } = useLiveQuery({
    query: (q) =>
      projectId
        ? q
            .from({ field: projectFieldCollection })
            .where(({ field }) => eq(field.projectId, projectId))
        : undefined,
  });
  return useMemo(
    () => [...(data ?? [])].sort(comparePosition).map(ordered),
    [data],
  );
}
