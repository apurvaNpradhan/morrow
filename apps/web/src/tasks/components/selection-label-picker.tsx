import { useBulkActions } from "../actions/use-bulk-actions";
import { useSelectedTasks } from "../queries/use-task-queries";
import { labelState } from "../lib/selection";
import { LabelPickerList } from "./label-picker-list";
import { useTaskView } from "./task-view-context";

/**
 * The label picker of the selection: a label is checked when every selected
 * task has it, dashed when some do. Picking a checked one takes it off all of
 * them; picking any other puts it on all of them.
 */
export function SelectionLabelPicker() {
  const { project, workspace, labels } = useTaskView();
  const bulk = useBulkActions();
  const tasks = useSelectedTasks(project.id);
  const states = new Map(
    labels.map((label) => [label.id, labelState(tasks, label.id)]),
  );

  return (
    <LabelPickerList
      workspaceId={workspace.id}
      labels={labels}
      selected={labels
        .filter((l) => states.get(l.id) === "all")
        .map((l) => l.id)}
      indeterminate={labels
        .filter((l) => states.get(l.id) === "some")
        .map((l) => l.id)}
      canCreate={false}
      onToggle={(labelId) =>
        void (states.get(labelId) === "all"
          ? bulk.removeLabel(labelId)
          : bulk.addLabel(labelId))
      }
    />
  );
}
