import {
  readDevicePreferences,
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import { isClosedCategory, type ProjectColumnRow } from "@morrow/sync-schemas";
import { openColumnIds } from "./preload-project-tasks";

/**
 * Which Columns of the board or list are expanded. Open Columns start
 * expanded; done and canceled ones start collapsed and load their tasks only
 * once expanded, so a Project's finished work costs nothing until it is opened.
 * Each Project's choices stay on this device, so they survive a reload.
 */
export function useColumnExpansion(
  projectId: string,
  columns: readonly ProjectColumnRow[],
) {
  const stored = useDevicePreferences().columnExpanded[projectId];

  const isExpanded = (column: ProjectColumnRow) =>
    stored?.[column.id] ?? !isClosedCategory(column.category);

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
    toggle: (column: ProjectColumnRow) => {
      const { columnExpanded } = readDevicePreferences();
      const current = columnExpanded[projectId] ?? {};
      // Entries of Columns that no longer exist are dropped on every write.
      const columnIds = new Set(columns.map((c) => c.id));
      const kept = Object.fromEntries(
        Object.entries(current).filter(([id]) => columnIds.has(id)),
      );
      const expanded = current[column.id] ?? !isClosedCategory(column.category);
      saveDevicePreferences({
        columnExpanded: {
          ...columnExpanded,
          [projectId]: { ...kept, [column.id]: !expanded },
        },
      });
    },
  };
}
