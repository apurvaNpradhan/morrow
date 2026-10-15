import { isClosedCategory, type ProjectColumnRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { openColumnIds } from "./preload-project-tasks";

/**
 * Which Columns of the board or list are expanded. Open Columns start
 * expanded; done and canceled ones start collapsed and load their tasks only
 * once expanded, so a Project's finished work costs nothing until it is opened.
 */
export function useColumnExpansion(columns: readonly ProjectColumnRow[]) {
  // Columns whose expanded state differs from its default (open: expanded).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());

  const isExpanded = (column: ProjectColumnRow) =>
    !isClosedCategory(column.category) !== flipped.has(column.id);

  const expandedIds = new Set(
    columns.flatMap((column) => (isExpanded(column) ? [column.id] : [])),
  );
  return {
    expandedIds,
    openIds: openColumnIds(columns),
    expandedClosedIds: columns.flatMap((column) =>
      isClosedCategory(column.category) && isExpanded(column)
        ? [column.id]
        : [],
    ),
    toggle: (column: ProjectColumnRow) =>
      setFlipped((current) => {
        const next = new Set(current);
        if (!next.delete(column.id)) next.add(column.id);
        return next;
      }),
  };
}
