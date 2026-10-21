import {
  readDevicePreferences,
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import type {
  SubTaskProperty,
  SubTaskView,
} from "@/app/preferences/device-preferences-collection";

/** How this device lists a task's sub-tasks in the sheet, and the way to change it. */
export function useSubTaskView() {
  const { subTaskView } = useDevicePreferences();
  const save = (patch: Partial<SubTaskView>) =>
    saveDevicePreferences({
      subTaskView: { ...readDevicePreferences().subTaskView, ...patch },
    });
  return {
    view: subTaskView,
    setSort: (sort: SubTaskView["sort"]) => save({ sort }),
    setCompleted: (completed: SubTaskView["completed"]) => save({ completed }),
    setNested: (nested: boolean) => save({ nested }),
    setShown(property: SubTaskProperty, on: boolean) {
      save({
        show: { ...readDevicePreferences().subTaskView.show, [property]: on },
      });
    },
  };
}
