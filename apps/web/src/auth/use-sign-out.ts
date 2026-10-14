import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "./lib/auth-client";
import { cleanupSyncedCollections } from "@/app/sync/synced-collections";

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: async () => {
            // Drop user-scoped data before leaving so the next sign-in on this
            // browser never sees it.
            queryClient.clear();
            await cleanupSyncedCollections();
            await navigate({ to: "/auth/sign-in" });
          },
        },
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}
