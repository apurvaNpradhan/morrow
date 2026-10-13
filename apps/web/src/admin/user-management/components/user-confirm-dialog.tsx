import { useTranslation } from "react-i18next";
import { useDeleteAdminUser } from "@/admin/user-management/queries/use-delete-admin-user";
import { useToggleAdminUserStatus } from "@/admin/user-management/queries/use-toggle-admin-user-status";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import type { PendingUserAction } from "@/admin/user-management/pending-user-action";

export function UserConfirmDialog({
  action,
  onClose,
}: {
  action: PendingUserAction | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: toggleStatus, isPending: isToggling } =
    useToggleAdminUserStatus();
  const { mutateAsync: deleteUser, isPending: isDeleting } =
    useDeleteAdminUser();
  const busy = isToggling || isDeleting;
  const name = action?.user.name ?? "";

  const copy = {
    deactivate: {
      title: t("settings:adminUsers.confirm.deactivate.title"),
      description: t("settings:adminUsers.confirm.deactivate.description", {
        name,
      }),
      action: t("settings:adminUsers.confirm.deactivate.action"),
    },
    reactivate: {
      title: t("settings:adminUsers.confirm.reactivate.title"),
      description: t("settings:adminUsers.confirm.reactivate.description", {
        name,
      }),
      action: t("settings:adminUsers.confirm.reactivate.action"),
    },
    delete: {
      title: t("settings:adminUsers.confirm.delete.title"),
      description: t("settings:adminUsers.confirm.delete.description", {
        name,
      }),
      action: t("settings:adminUsers.confirm.delete.action"),
    },
  }[action?.type ?? "delete"];

  const confirm = async () => {
    if (!action) return;
    try {
      if (action.type === "delete") {
        await deleteUser({ userId: action.user.id });
      } else {
        await toggleStatus({
          userId: action.user.id,
          deactivate: action.type === "deactivate",
        });
      }
      onClose();
    } catch {
      // The mutation reports the failure; keep the dialog open to retry.
    }
  };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.action}
      pendingLabel={t("settings:adminUsers.confirm.working")}
      pending={busy}
      destructive={action?.type !== "reactivate"}
      onConfirm={confirm}
    />
  );
}
