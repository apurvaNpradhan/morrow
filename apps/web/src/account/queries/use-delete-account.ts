import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { detailCode } from "@/app/lib/orpc-error";

export const SESSION_TOO_OLD = "SESSION_TOO_OLD";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      try {
        return await rpc.account.deleteAccount();
      } catch (error) {
        // Deleting an account needs a recent sign-in.
        if (detailCode(error) === "SESSION_EXPIRED") {
          throw new Error(SESSION_TOO_OLD);
        }
        throw error;
      }
    },
  });
}
