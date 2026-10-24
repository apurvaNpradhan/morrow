import {
  readDevicePreferences,
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import { fieldIdOf } from "@/app/preferences/task-view-options";
import { useProjectFields } from "@/projects";
import type { TaskDisplay } from "../components/task-view-context";
import { pruneFieldFilters, type TaskFilter } from "./filters";
import { DEFAULT_SORT, type TaskSort } from "./sort";

const NO_FILTERS: TaskFilter[] = [];

/** Display toggles by their device-preference key. */
const DISPLAY_KEYS = {
  numbers: "showTaskNumbers",
  assignees: "showTaskAssignees",
  startDates: "showTaskStartDate",
  dueDates: "showTaskDueDates",
  priority: "showTaskPriority",
} as const satisfies Record<keyof TaskDisplay, string>;

/** What the device remembers about how a Project's tasks are shown. */
export function useTaskViewPreferences(projectId: string) {
  const preferences = useDevicePreferences();
  const fields = useProjectFields(projectId);
  const storedSort = preferences.taskSorts[projectId];
  // A filter or sort naming a Field or option since deleted is dropped quietly.
  const filters = pruneFieldFilters(
    preferences.taskFilters[projectId] ?? NO_FILTERS,
    fields,
  ) as TaskFilter[];
  const sortFieldId = storedSort ? fieldIdOf(storedSort.field) : null;
  const sort =
    storedSort &&
    (sortFieldId === null || fields.some((field) => field.id === sortFieldId))
      ? storedSort
      : DEFAULT_SORT;

  const display: TaskDisplay = {
    numbers: preferences.showTaskNumbers,
    assignees: preferences.showTaskAssignees,
    startDates: preferences.showTaskStartDate,
    dueDates: preferences.showTaskDueDates,
    priority: preferences.showTaskPriority,
  };

  return {
    layout: preferences.taskView,
    filters,
    sort,
    fields,
    display,
    showBackground: preferences.showProjectBackgrounds,
    /** A Field's value shows on cards and rows unless this device switched it off. */
    showsField: (fieldId: string) =>
      preferences.showTaskFields[fieldId] !== false,
    setShowField(fieldId: string, value: boolean) {
      const { showTaskFields } = readDevicePreferences();
      saveDevicePreferences({
        showTaskFields: { ...showTaskFields, [fieldId]: value },
      });
    },
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
        showTaskStartDate: true,
        showTaskDueDates: true,
        showTaskPriority: true,
        showTaskFields: {},
        taskSorts: others,
      });
    },
  };
}
