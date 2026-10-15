import type { TaskRow } from "@morrow/sync-schemas";
import { useSortable } from "@dnd-kit/react/sortable";
import { TaskListRow } from "./task-list-row";
import { useTaskView } from "./task-view-context";

/** A list row that can be dragged within its group and to another one. */
export function SortableTaskListRow({
  task,
  index,
  groupId,
}: {
  task: TaskRow;
  /** Its place in the whole group, not among the rows that are rendered. */
  index: number;
  /** The group it is shown in now, which follows it while it is dragged. */
  groupId: string;
}) {
  const { can, frozen } = useTaskView();
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    group: groupId,
    type: "task",
    accept: "task",
    data: { columnId: groupId },
    disabled: !can.edit || frozen,
  });
  return <TaskListRow task={task} rowRef={ref} dragging={isDragging} />;
}
