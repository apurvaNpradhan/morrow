import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { rpc } from "@/app/lib/orpc";
import { toast } from "@/design-system/toast";
import { syncAdminWorkspaceMembers } from "@/admin/lib/sync-admin-workspace-members";

export function useTransferAdminWorkspaceOwnership() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      variables: Parameters<typeof rpc.admin.workspaces.transferOwnership>[0],
    ) => rpc.admin.workspaces.transferOwnership(variables),
    onSuccess: (members, { workspaceId }) => {
      toast.success(t("settings:adminWorkspaces.toast.ownershipTransferred"));
      syncAdminWorkspaceMembers(queryClient, workspaceId, members);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.transferError"),
      );
    },
  });
}
