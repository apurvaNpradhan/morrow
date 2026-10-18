import { useTaskView } from "./task-view-context";
import { useTaskViewModel } from "../lib/use-task-view-model";
import type { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { useColumnExpansion } from "../lib/use-column-expansion";
import {
  useExpandedColumnsTasks,
  useOpenColumnsTasks,
} from "../queries/use-task-queries";
import { TaskBoard } from "./task-board";
import { TaskToolbar } from "./task-toolbar";
import type { ToolbarState } from "./use-toolbar-state";

/**
 * The board layout: the toolbar and the Project's unarchived tasks as lanes.
 * Open Columns' lanes load with the page; done and canceled lanes start
 * collapsed, as in the list, and load when expanded.
 */
export function BoardView({
  toolbar,
  preferences,
}: {
  toolbar: ToolbarState;
  preferences: ReturnType<typeof useTaskViewPreferences>;
}) {
  const { project, columns, meId, today } = useTaskView();
  const { expandedIds, openIds, expandedClosedIds, toggle } =
    useColumnExpansion(project.id, columns);
  const openTasks = useOpenColumnsTasks(project.id, openIds);
  const closed = useExpandedColumnsTasks(project.id, expandedClosedIds);
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
        <TaskBoard
          project={project}
          columns={columns}
          tasksByColumn={model.byColumn}
          expandedIds={expandedIds}
          onToggle={toggle}
          loadingColumnIds={
            closed.isLoading ? new Set(expandedClosedIds) : new Set()
          }
          manualSort={preferences.sort.field === "manual"}
          filtered={model.narrowed}
        />
      </div>
    </div>
  );
}
