import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { errorCode } from "@/app/lib/orpc-error";
import { rpc } from "@/app/lib/orpc";

export const ADMIN_ACCESS_QUERY_KEY = ["admin", "access"] as const;

export function adminAccessQueryOptions(userId: string | null | undefined) {
  return queryOptions({
    queryKey: [...ADMIN_ACCESS_QUERY_KEY, userId ?? ""],
    queryFn: async () => {
      try {
        await rpc.admin.access();
        return true;
      } catch (error) {
        // Not an administrator: an answer, not a failure.
        const code = errorCode(error);
        if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return false;
        throw error;
      }
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminAccess() {
  const { user } = useAuth();
  return useQuery(adminAccessQueryOptions(user?.id));
}
