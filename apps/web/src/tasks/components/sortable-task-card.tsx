import type { TaskRow } from "@morrow/sync-schemas";
import { useSortable } from "@dnd-kit/react/sortable";
import { TaskCard } from "./task-card";
import { useTaskView } from "./task-view-context";

/** A card that can be dragged within its lane and to another one. */
export function SortableTaskCard({
  task,
  index,
  laneId,
}: {
  task: TaskRow;
  /** Its place in the whole lane, not among the cards that are rendered. */
  index: number;
  /** The lane it is shown in now, which follows it while it is dragged. */
  laneId: string;
}) {
  const { can, frozen } = useTaskView();
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    group: laneId,
    type: "task",
    accept: "task",
    data: { columnId: laneId },
    disabled: !can.edit || frozen,
  });
  return <TaskCard task={task} cardRef={ref} dragging={isDragging} />;
}
