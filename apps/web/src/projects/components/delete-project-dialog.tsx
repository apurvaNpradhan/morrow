import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectRow } from "@morrow/sync-schemas";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { deleteProject } from "../actions/project-actions";

/**
 * Deleting a Project removes its tasks too, so the key has to be typed. Used by
 * the Project's settings and by the sidebar menu; `onDeleted` says where to go.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: ProjectRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation("projects");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success(t("general.danger.success"));
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(t, error, t("general.danger.error")));
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) {
          onOpenChange(next);
          if (!next) setTyped("");
        }
      }}
      title={t("general.danger.modalTitle")}
      description={t("general.danger.modalDescription", { name: project.name })}
      confirmLabel={t("general.danger.modalConfirm")}
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      confirmDisabled={typed.trim().toUpperCase() !== project.key}
      onConfirm={() => void remove()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="delete-project-key">
          {t("general.danger.typeKey", { key: project.key })}
        </Label>
        <Input
          id="delete-project-key"
          className="font-mono uppercase"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}
