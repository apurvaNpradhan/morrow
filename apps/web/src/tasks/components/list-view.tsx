import { useState } from "react";
import { useColumnExpansion } from "../lib/use-column-expansion";
import { useTaskViewModel } from "../lib/use-task-view-model";
import type { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import {
  useArchivedTasks,
  useExpandedColumnsTasks,
  useOpenColumnsTasks,
} from "../queries/use-task-queries";
import { TaskList } from "./task-list";
import { TaskToolbar } from "./task-toolbar";
import { useTaskView } from "./task-view-context";
import type { ToolbarState } from "./use-toolbar-state";

/**
 * The list layout. Open Columns' groups load with the page; done and canceled
 * groups start collapsed and load when expanded, as does the Archived group,
 * so opening the list costs what opening the board does.
 */
export function ListView({
  toolbar,
  preferences,
}: {
  toolbar: ToolbarState;
  preferences: ReturnType<typeof useTaskViewPreferences>;
}) {
  const { project, columns, meId, today } = useTaskView();
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const { expandedIds, openIds, expandedClosedIds, toggle } =
    useColumnExpansion(project.id, columns);

  const openTasks = useOpenColumnsTasks(project.id, openIds);
  const closed = useExpandedColumnsTasks(project.id, expandedClosedIds);
  const archived = useArchivedTasks(project.id, archivedExpanded);

  const model = useTaskViewModel({
    projectKey: project.key,
    columns,
    tasks: [...openTasks, ...closed.tasks],
    filters: preferences.filters,
    search: toolbar.search,
    sort: preferences.sort,
    meId,
    today,
  });
  const archivedModel = useTaskViewModel({
    projectKey: project.key,
    columns,
    tasks: archived.tasks,
    filters: preferences.filters,
    search: toolbar.search,
    sort: preferences.sort,
    meId,
    today,
  });
  const archivedTasks = columns.flatMap(
    (column) => archivedModel.byColumn.get(column.id) ?? [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TaskToolbar
        shown={model.shown}
        total={model.total}
        search={toolbar.search}
        onSearchChange={toolbar.setSearch}
        searchRef={toolbar.searchRef}
        preferences={preferences}
        filters={preferences.filters}
        onFiltersChange={preferences.setFilters}
        filterOpen={toolbar.filterOpen}
        onFilterOpenChange={toolbar.setFilterOpen}
        displayOpen={toolbar.displayOpen}
        onDisplayOpenChange={toolbar.setDisplayOpen}
        hasBackground={project.backgroundUrl !== null}
      />
      <div className="min-h-0 flex-1">
        <TaskList
          columns={columns}
          tasksByColumn={model.byColumn}
          expandedIds={expandedIds}
          onToggle={toggle}
          loadingColumnIds={
            closed.isLoading ? new Set(expandedClosedIds) : new Set()
          }
          manualSort={preferences.sort.field === "manual"}
          archived={{
            tasks: archivedTasks,
            expanded: archivedExpanded,
            loading: archived.isLoading,
            onToggle: () => setArchivedExpanded((expanded) => !expanded),
          }}
        />
      </div>
    </div>
  );
}
