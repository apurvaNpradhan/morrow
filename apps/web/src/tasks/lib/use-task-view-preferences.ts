import {
  readDevicePreferences,
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import type { TaskDisplay } from "../components/task-view-context";
import type { TaskFilter } from "./filters";
import { DEFAULT_SORT, type TaskSort } from "./sort";

const NO_FILTERS: TaskFilter[] = [];

/** Display toggles by their device-preference key. */
const DISPLAY_KEYS = {
  numbers: "showTaskNumbers",
  assignees: "showTaskAssignees",
  dueDates: "showTaskDueDates",
  priority: "showTaskPriority",
  checklist: "showTaskChecklist",
} as const satisfies Record<keyof TaskDisplay, string>;

/** What the device remembers about how a Project's tasks are shown. */
export function useTaskViewPreferences(projectId: string) {
  const preferences = useDevicePreferences();

  const display: TaskDisplay = {
    numbers: preferences.showTaskNumbers,
    assignees: preferences.showTaskAssignees,
    dueDates: preferences.showTaskDueDates,
    priority: preferences.showTaskPriority,
    checklist: preferences.showTaskChecklist,
  };

  return {
    layout: preferences.taskView,
    filters: preferences.taskFilters[projectId] ?? NO_FILTERS,
    sort: preferences.taskSorts[projectId] ?? DEFAULT_SORT,
    display,
    showBackground: preferences.showProjectBackgrounds,
    setLayout: (layout: "board" | "list") =>
      saveDevicePreferences({ taskView: layout }),
    setFilters(filters: TaskFilter[]) {
      const { taskFilters } = readDevicePreferences();
      const { [projectId]: _dropped, ...others } = taskFilters;
      saveDevicePreferences({
        taskFilters:
          filters.length > 0 ? { ...others, [projectId]: filters } : others,
      });
    },
    setSort(sort: TaskSort) {
      const { taskSorts } = readDevicePreferences();
      saveDevicePreferences({ taskSorts: { ...taskSorts, [projectId]: sort } });
    },
    setDisplay(key: keyof TaskDisplay, value: boolean) {
      saveDevicePreferences({ [DISPLAY_KEYS[key]]: value });
    },
    setShowBackground: (value: boolean) =>
      saveDevicePreferences({ showProjectBackgrounds: value }),
    /** Toggles back on and the sort back to manual; filters are left alone. */
    reset() {
      const { taskSorts } = readDevicePreferences();
      const { [projectId]: _dropped, ...others } = taskSorts;
      saveDevicePreferences({
        showTaskNumbers: true,
        showTaskAssignees: true,
        showTaskDueDates: true,
        showTaskPriority: true,
        showTaskChecklist: true,
        taskSorts: others,
      });
    },
  };
}
