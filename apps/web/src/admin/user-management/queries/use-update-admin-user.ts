import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { rpc } from "@/app/lib/orpc";
import { ADMIN_USERS_QUERY_KEY } from "@/admin/use-admin-users";
import { toast } from "@/design-system/toast";

export function useUpdateAdminUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: Parameters<typeof rpc.admin.users.update>[0]) =>
      rpc.admin.users.update(variables),
    onSuccess: () => {
      toast.success(t("settings:adminUsers.toast.updated"));
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.updateError"),
      );
    },
  });
}
