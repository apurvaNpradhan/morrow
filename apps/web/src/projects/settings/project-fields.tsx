import type { ProjectRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { toast } from "@/design-system/toast";
import { useWorkspacePermission } from "@/workspace";
import { createField, updateField } from "../actions/field-actions";
import { useSortableList } from "../lib/use-sortable-list";
import { useProjectFields } from "../queries/use-project-fields";
import { AddFieldForm } from "./add-field-form";
import { DeleteFieldDialog, type FieldDeletion } from "./delete-field-dialog";
import { FieldCard } from "./field-card";

/** A project's custom Fields and their options: add, rename, recolour, reorder and delete. */
export function ProjectFields({
  workspaceId,
  project,
}: {
  workspaceId: string;
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects } = useWorkspacePermission();
  const fields = useProjectFields(project.id);
  const [deleting, setDeleting] = useState<FieldDeletion | null>(null);
  const disabled = project.archivedAt !== null || !canManageProjects();
  const sortable = useSortableList({
    items: fields,
    disabled,
    onMove: (field, position) => updateField(field.id, { position }),
    onError: (error) =>
      toast.error(errorMessage(t, error, t("fields.reorderFieldError"))),
  });

  return (
    <>
      <p className="-mt-6 text-sm text-muted-foreground">
        {t("fields.subtitle", { name: project.name })}
      </p>
      <div className="space-y-6">
        {fields.map((field, index) => (
          <FieldCard
            key={field.id}
            field={field}
            workspaceId={workspaceId}
            disabled={disabled}
            onDeleteField={(picked) => setDeleting({ field: picked })}
            onDeleteOption={(picked, option) =>
              setDeleting({ field: picked, option })
            }
            dropIndicator={sortable.dropIndicator(field.id)}
            dragging={sortable.isDragging(field.id)}
            rowProps={sortable.rowProps(field, index)}
            handleProps={sortable.handleProps(field, index)}
          />
        ))}
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("fields.empty")}</p>
        ) : null}
        {disabled ? null : (
          <SettingsCard>
            <AddFieldForm
              onAdd={(field) =>
                createField({ workspaceId, projectId: project.id }, field)
              }
            />
          </SettingsCard>
        )}
      </div>
      <DeleteFieldDialog
        workspaceId={workspaceId}
        deletion={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
