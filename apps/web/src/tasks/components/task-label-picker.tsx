import { useTaskActions } from "../actions/use-task-actions";
import { useTask } from "../queries/use-task-queries";
import { LabelPickerList } from "./label-picker-list";
import { useTaskView } from "./task-view-context";

/** The label picker of one task: picking applies or removes the label on it. */
export function TaskLabelPicker({ taskId }: { taskId: string }) {
  const { workspace, labels, can } = useTaskView();
  const actions = useTaskActions();
  const task = useTask(taskId);
  if (!task) return null;

  return (
    <LabelPickerList
      workspaceId={workspace.id}
      labels={labels}
      selected={task.labelIds}
      canCreate={can.createLabel}
      onToggle={(labelId) => void actions.toggleLabel(task, labelId)}
    />
  );
}
