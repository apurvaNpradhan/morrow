import type { FieldOption, ProjectFieldRow } from "@morrow/sync-schemas";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { orpc } from "@/app/lib/orpc";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { deleteField, deleteOption } from "../actions/field-actions";

export type FieldDeletion = {
  field: ProjectFieldRow;
  /** Set to delete one option instead of the whole Field. */
  option?: FieldOption;
};

/** Says how many Tasks hold the value, then deletes the Field or option and clears it from all of them. */
export function DeleteFieldDialog({
  workspaceId,
  deletion,
  onClose,
}: {
  workspaceId: string;
  /** What to delete; the dialog is open while it is set. */
  deletion: FieldDeletion | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("projects");
  const [deleting, setDeleting] = useState(false);
  const { data: usage } = useQuery({
    ...orpc.projects.fields.usage.queryOptions({
      input: { workspaceId, projectId: deletion?.field.projectId ?? "" },
    }),
    enabled: deletion !== null,
    // The count must be what is true now, not what was true when the page opened.
    staleTime: 0,
    gcTime: 0,
  });
  const count =
    usage && deletion
      ? (usage.find(
          (row) =>
            row.fieldId === deletion.field.id &&
            row.optionId === (deletion.option?.id ?? null),
        )?.count ?? 0)
      : null;
  const kind = deletion?.option ? "option" : "field";

  async function confirm() {
    if (!deletion) return;
    setDeleting(true);
    try {
      if (deletion.option) {
        await deleteOption(
          {
            workspaceId,
            projectId: deletion.field.projectId,
            fieldId: deletion.field.id,
          },
          deletion.option.id,
        );
      } else {
        await deleteField(deletion.field.id);
      }
      toast.success(t(`fields.${kind}DeleteSuccess`));
      onClose();
    } catch (error) {
      toast.error(errorMessage(t, error, t(`fields.${kind}DeleteError`)));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      open={deletion !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
      title={t(`fields.${kind}DeleteTitle`, {
        name: deletion?.option?.name ?? deletion?.field.name ?? "",
      })}
      description={
        count === null
          ? t("fields.deleteCounting")
          : t(`fields.${kind}DeleteDescription`, { count })
      }
      confirmLabel={t(`fields.${kind}DeleteConfirm`)}
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      confirmDisabled={count === null}
      onConfirm={() => void confirm()}
    />
  );
}
