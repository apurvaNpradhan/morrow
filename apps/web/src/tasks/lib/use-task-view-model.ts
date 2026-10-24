import type {
  ProjectColumnRow,
  ProjectFieldRow,
  TaskRow,
} from "@morrow/sync-schemas";
import { useDeferredValue, useMemo } from "react";
import { localeWeekStart } from "./calendar-day";
import { matchesFilters, type TaskFilter } from "./filters";
import { useRelationSets } from "../queries/use-relation-sets";
import { matchesSearch } from "./search";
import { sortTasks, type TaskSort } from "./sort";

/**
 * The tasks a view shows: those that pass the search and the filters, grouped
 * by Column and sorted, with the counts for "N of M tasks". Everything is done
 * here on the loaded tasks; nothing is asked of the server.
 *
 * Sorting is the expensive part and depends only on the tasks and the sort, so
 * it is its own step: typing in the search or changing a filter only filters
 * lists that are already in order. The search is deferred, so a keystroke
 * paints the input before the lists are filtered.
 */
export function useTaskViewModel({
  projectKey,
  columns,
  fields,
  tasks,
  filters,
  search,
  sort,
  meId,
  today,
  timeZone,
}: {
  projectKey: string;
  columns: ProjectColumnRow[];
  /** The Project's Fields, for sorting by one. */
  fields: readonly ProjectFieldRow[];
  tasks: readonly TaskRow[];
  filters: readonly TaskFilter[];
  search: string;
  sort: TaskSort;
  meId: string;
  today: string;
  timeZone: string;
}) {
  const sorted = useMemo(() => {
    const byColumn = new Map<string, TaskRow[]>(
      columns.map((column) => [column.id, []]),
    );
    for (const task of tasks) byColumn.get(task.columnId)?.push(task);
    for (const [columnId, inColumn] of byColumn) {
      byColumn.set(columnId, sortTasks(inColumn, sort, fields));
    }
    return byColumn;
  }, [columns, fields, sort, tasks]);

  const deferredSearch = useDeferredValue(search);
  const relations = useRelationSets(
    filters.some((filter) => filter.subject === "relation"),
  );

  return useMemo(() => {
    if (deferredSearch.trim() === "" && filters.length === 0) {
      return {
        byColumn: sorted,
        total: tasks.length,
        shown: tasks.length,
        narrowed: false,
      };
    }
    const context = {
      meId,
      today,
      timeZone,
      weekStartsOn: localeWeekStart(),
      relations,
    };
    const byColumn = new Map<string, TaskRow[]>();
    let shown = 0;
    for (const [columnId, inColumn] of sorted) {
      const kept = inColumn.filter(
        (task) =>
          matchesSearch(task, projectKey, deferredSearch) &&
          matchesFilters(task, filters, context),
      );
      byColumn.set(columnId, kept);
      shown += kept.length;
    }
    return {
      byColumn,
      total: tasks.length,
      shown,
      narrowed: shown !== tasks.length,
    };
  }, [
    deferredSearch,
    filters,
    meId,
    projectKey,
    relations,
    sorted,
    tasks,
    timeZone,
    today,
  ]);
}
