import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { rpc } from "@/app/lib/orpc";
import { ADMIN_USERS_QUERY_KEY } from "@/admin/use-admin-users";
import { toast } from "@/design-system/toast";

export function useToggleAdminUserStatus() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      variables: Parameters<typeof rpc.admin.users.setDeactivated>[0],
    ) => rpc.admin.users.setDeactivated(variables),
    onSuccess: (_, variables) => {
      toast.success(
        t(
          variables.deactivate
            ? "settings:adminUsers.toast.deactivated"
            : "settings:adminUsers.toast.reactivated",
        ),
      );
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.actionError"),
      );
    },
  });
}
