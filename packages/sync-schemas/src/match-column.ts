import type { ColumnCategory } from "./projects.js";

type Column = { id: string; name: string; category: ColumnCategory };

/**
 * The project's column for an imported task: the one with the same name, else
 * the first of the task's category (its own, or the one the file gives that
 * column name), else the first `unstarted` one. `exact` is false when the name
 * did not match, which the importer reports.
 */
export function matchColumn<Match extends Column>(
  columns: Match[],
  imported: { column: string; category?: ColumnCategory },
  fileColumns: { name: string; category: ColumnCategory }[],
) {
  const byName = columns.find((column) => column.name === imported.column);
  if (byName) return { column: byName, exact: true };
  const category =
    imported.category ??
    fileColumns.find((column) => column.name === imported.column)?.category;
  const byCategory = columns.find((column) => column.category === category);
  const fallback = columns.find((column) => column.category === "unstarted");
  const column = byCategory ?? fallback;
  if (!column) throw new Error("A project always has an unstarted column");
  return { column, exact: false };
}
