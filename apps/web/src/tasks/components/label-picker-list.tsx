import type { LabelRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { createLabel, LabelDot } from "@/labels";
import { FilterOptionList } from "./filter-option-list";

/**
 * A searchable checklist of the Workspace's labels. Picking toggles a label and
 * the list stays open. Where the user may create labels, what was typed becomes
 * a new label (and is picked at once) when nothing matches it exactly.
 */
export function LabelPickerList({
  workspaceId,
  labels,
  selected,
  indeterminate,
  canCreate,
  onToggle,
}: {
  workspaceId: string;
  labels: readonly LabelRow[];
  selected: readonly string[];
  /** Labels some but not all of a batch of tasks have. */
  indeterminate?: readonly string[];
  canCreate: boolean;
  onToggle: (labelId: string) => void;
}) {
  const { t } = useTranslation("tasks");

  async function createAndPick(name: string) {
    try {
      const label = await createLabel({ workspaceId, name });
      onToggle(label.id);
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
      selected={new Set(selected)}
      indeterminate={indeterminate ? new Set(indeterminate) : undefined}
      label={t("fields.labels")}
      onPick={onToggle}
      create={
        canCreate
          ? {
              label: (name) => t("labels.create", { name }),
              onCreate: (name) => void createAndPick(name),
            }
          : undefined
      }
    />
  );
}
