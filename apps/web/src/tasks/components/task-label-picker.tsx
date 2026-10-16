import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { createLabel, LabelDot } from "@/labels";
import { useTaskActions } from "../actions/use-task-actions";
import { useTask } from "../queries/use-task-queries";
import { FilterOptionList } from "./filter-option-list";
import { useTaskView } from "./task-view-context";

/**
 * A searchable checklist of the Workspace's labels for one task. Picking
 * toggles a label and the list stays open. Where the user may create labels,
 * what was typed becomes a new label (applied at once) when nothing matches it.
 */
export function TaskLabelPicker({ taskId }: { taskId: string }) {
  const { t } = useTranslation("tasks");
  const { workspace, labels, can } = useTaskView();
  const actions = useTaskActions();
  const task = useTask(taskId);
  if (!task) return null;

  async function createAndApply(name: string) {
    if (!task) return;
    try {
      const label = await createLabel({ workspaceId: workspace.id, name });
      await actions.toggleLabel(task, label.id);
    } catch (error) {
      toast.error(errorMessage(t, error, t("labels.createError")));
    }
  }

  return (
    <FilterOptionList
      options={labels.map((label) => ({
        value: label.id,
        label: label.name,
        glyph: <LabelDot color={label.color} />,
      }))}
      selected={new Set(task.labelIds)}
      label={t("fields.labels")}
      onPick={(labelId) => void actions.toggleLabel(task, labelId)}
      create={
        can.createLabel
          ? {
              label: (name) => t("labels.create", { name }),
              onCreate: (name) => void createAndApply(name),
            }
          : undefined
      }
    />
  );
}
