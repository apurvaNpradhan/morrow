import {
  isClosedCategory,
  type ProjectColumnRow,
  type TaskRow,
} from "@morrow/sync-schemas";
import type { SubTaskView } from "@/app/preferences/device-preferences-collection";
import { sortTasks, type SortableField } from "./sort";

/**
 * The sub-tasks of one task as the sheet lists them: closed ones left out when
 * the view says so, then ordered. Archived sub-tasks never show.
 */
export function arrangeSubTasks(
  tasks: readonly TaskRow[],
  columnById: ReadonlyMap<string, Pick<ProjectColumnRow, "category">>,
  view: Pick<SubTaskView, "sort" | "completed">,
  fields: readonly SortableField[],
): TaskRow[] {
  const shown = tasks.filter((task) => {
    if (task.archivedAt) return false;
    const column = columnById.get(task.columnId);
    return !(
      view.completed === "none" &&
      column &&
      isClosedCategory(column.category)
    );
  });
  return sortTasks(shown, view.sort, fields);
}
