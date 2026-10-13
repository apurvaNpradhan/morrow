import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { refreshSession } from "@/auth";
import { invalidateUserProfileQueries } from "./invalidate-user-profile-queries";

type UpdateUserProfileRequest = {
  name?: string;
  locale?: string;
};

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UpdateUserProfileRequest) => {
      const result = await rpc.account.updateProfile(profile);
      refreshSession();
      return result;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}
