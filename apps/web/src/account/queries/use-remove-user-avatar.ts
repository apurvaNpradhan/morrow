import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { refreshSession } from "@/auth";
import { invalidateUserProfileQueries } from "./invalidate-user-profile-queries";

export function useRemoveUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const removed = await rpc.account.removeAvatar();
      refreshSession();
      return removed;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}
