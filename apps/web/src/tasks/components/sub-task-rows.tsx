import { Fragment } from "react";
import { arrangeSubTasks } from "../lib/sub-tasks";
import { useSubTaskView } from "../lib/use-sub-task-view";
import { useSubtasks } from "../queries/use-task-queries";
import { TaskListRow } from "./task-list-row";
import { useTaskView } from "./task-view-context";

/**
 * The sub-tasks of `parentId` as rows, each followed by its own when the view
 * nests them. Every level reads its own children, so a collapsed or closed
 * branch costs nothing.
 */
export function SubTaskRows({
  parentId,
  depth = 0,
}: {
  parentId: string;
  depth?: number;
}) {
  const { columnById, fields } = useTaskView();
  const { view } = useSubTaskView();
  const children = arrangeSubTasks(
    useSubtasks(parentId),
    columnById,
    view,
    fields,
  );
  return children.map((task) => (
    <Fragment key={task.id}>
      <TaskListRow task={task} subTask={{ depth, show: view.show }} />
      {view.nested && task.subtaskTotal > 0 ? (
        <SubTaskRows parentId={task.id} depth={depth + 1} />
      ) : null}
    </Fragment>
  ));
}
