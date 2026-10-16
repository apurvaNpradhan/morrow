import type { LabelRow } from "@morrow/sync-schemas";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { orpc } from "@/app/lib/orpc";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { deleteLabel } from "../actions/label-actions";

/** Says how many tasks use the label, then deletes it everywhere. */
export function DeleteLabelDialog({
  label,
  onClose,
}: {
  /** The label to delete; the dialog is open while it is set. */
  label: LabelRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("labels");
  const [deleting, setDeleting] = useState(false);
  const { data: usage } = useQuery({
    ...orpc.labels.usage.queryOptions({
      input: { workspaceId: label?.workspaceId ?? "" },
    }),
    enabled: label !== null,
    // The count must be what is true now, not what was true when the page opened.
    staleTime: 0,
    gcTime: 0,
  });
  const count = usage
    ? (usage.find((row) => row.labelId === label?.id)?.count ?? 0)
    : null;

  async function confirm() {
    if (!label) return;
    setDeleting(true);
    try {
      await deleteLabel(label.id);
      toast.success(t("settings.deleteSuccess"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.deleteError")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      open={label !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
      title={t("settings.deleteTitle", { name: label?.name ?? "" })}
      description={
        count === null
          ? t("settings.deleteCounting")
          : t("settings.deleteDescription", { count })
      }
      confirmLabel={t("settings.deleteConfirm")}
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      confirmDisabled={count === null}
      onConfirm={() => void confirm()}
    />
  );
}
