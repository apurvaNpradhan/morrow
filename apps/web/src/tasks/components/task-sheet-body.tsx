import type { TaskRow } from "@morrow/sync-schemas";
import { TaskDetails } from "./task-details";
import { TaskSheetHeader } from "./task-sheet-header";

/** An open task in the sheet: its header, then the shared details. */
export function TaskSheetBody({ task }: { task: TaskRow }) {
  return (
    <>
      <TaskSheetHeader task={task} />
      <TaskDetails task={task} />
    </>
  );
}
