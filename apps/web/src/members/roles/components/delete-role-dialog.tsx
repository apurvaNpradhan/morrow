import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { useDeleteWorkspaceRole } from "@/members/roles/queries/use-delete-workspace-role";
import type { WorkspaceRole } from "@/members/roles/queries/use-workspace-roles";

export function DeleteRoleDialog({
  role,
  workspaceId,
  onDeleted,
  onCancel,
}: {
  role: WorkspaceRole | null;
  workspaceId: string;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: deleteRole, isPending } = useDeleteWorkspaceRole();

  return (
    <ConfirmDialog
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t("settings:workspaceRoles.deleteDialog.title")}
      description={
        role
          ? t("settings:workspaceRoles.deleteDialog.description", {
              role: role.role,
            })
          : ""
      }
      confirmLabel={t("common:actions.delete")}
      pending={isPending}
      onConfirm={async () => {
        if (!role) return;
        try {
          await deleteRole({ workspaceId, roleName: role.role });
          toast.success(t("settings:workspaceRoles.toast.deleted"));
          // A failed delete leaves the confirmation visible.
          onDeleted();
        } catch (error) {
          toast.error(
            errorMessage(
              t,
              error,
              t("settings:workspaceRoles.toast.deleteError"),
            ),
          );
        }
      }}
    />
  );
}
