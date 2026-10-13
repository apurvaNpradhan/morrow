import { useMutation, useQueryClient } from "@tanstack/react-query";
import { prepareAvatarImage } from "@/account/prepare-avatar-image";
import { rpc } from "@/app/lib/orpc";
import { refreshSession } from "@/auth";
import { invalidateUserProfileQueries } from "./invalidate-user-profile-queries";

export function useUpdateUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const avatar = await rpc.account.uploadAvatar({
        file: await prepareAvatarImage(file),
      });
      refreshSession();
      return avatar;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}
