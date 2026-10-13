import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "./lib/auth-client";

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Drop user-scoped data before leaving so the next sign-in on this
            // browser never sees it.
            queryClient.clear();
            navigate({ to: "/auth/sign-in" });
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
