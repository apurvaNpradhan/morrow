import { compareColumns, type ProjectColumnRow } from "@morrow/sync-schemas";
import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
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
