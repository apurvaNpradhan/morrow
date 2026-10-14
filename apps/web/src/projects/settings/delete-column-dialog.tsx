import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { Label } from "@/design-system/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { deleteColumn } from "../actions/column-actions";

type DeleteColumnDialogProps = {
  /** The column to delete; the dialog is open while it is set. */
  column: ProjectColumnRow | null;
  /** Every column of the project, in board order. */
  columns: ProjectColumnRow[];
  onClose: () => void;
};

/** Asks where the column's items go, then deletes it. */
export function DeleteColumnDialog({
  column,
  columns,
  onClose,
}: DeleteColumnDialogProps) {
  const { t } = useTranslation("projects");
  const [chosen, setChosen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const others = columns.filter((candidate) => candidate.id !== column?.id);
  // Prefer a neighbour of the same category; the first other column otherwise.
  const target =
    others.find((candidate) => candidate.id === chosen) ??
    others.find((candidate) => candidate.category === column?.category) ??
    others[0];

  async function confirm() {
    if (!column || !target) return;
    setDeleting(true);
    try {
      await deleteColumn(column.id, target.id);
      toast.success(t("workflow.deleteSuccess"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(t, error, t("workflow.deleteError")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      open={column !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) {
          setChosen(null);
          onClose();
        }
      }}
      title={t("workflow.deleteTitle", { name: column?.name ?? "" })}
      description={t("workflow.deleteDescription")}
      confirmLabel={t("workflow.deleteConfirm")}
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      confirmDisabled={!target}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-1.5">
        <Label>{t("workflow.deleteTargetLabel")}</Label>
        <Select
          value={target?.id ?? null}
          onValueChange={(value) => setChosen(value)}
          items={others.map((other) => ({
            value: other.id,
            label: other.name,
          }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {others.map((other) => (
              <SelectItem key={other.id} value={other.id}>
                {other.name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>
    </ConfirmDialog>
  );
}
