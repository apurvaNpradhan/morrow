import type { ProjectColumnRow } from "@morrow/sync-schemas";

/**
 * How full each `started` Column's status icon is: the Columns of that
 * category, in board order, fill it in even steps, so a Project with one
 * Column shows half a pie and one with two shows a third and two thirds.
 * Other categories have a fixed icon and no entry.
 */
export function statusFractions(columns: readonly ProjectColumnRow[]) {
  const started = columns.filter((column) => column.category === "started");
  return new Map(
    started.map((column, at) => [column.id, (at + 1) / (started.length + 1)]),
  );
}
