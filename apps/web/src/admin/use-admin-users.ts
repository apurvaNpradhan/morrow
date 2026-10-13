import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { rpc } from "@/app/lib/orpc";
import {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_SEARCH_MAX_LENGTH,
} from "./lib/admin-types";

export {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_SEARCH_MAX_LENGTH,
  type AdminUser,
} from "./lib/admin-types";

export const ADMIN_USERS_QUERY_KEY = ["admin", "users"] as const;

export function useAdminUsers(search: string, page: number) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, userId, search.trim(), page],
    queryFn: () => {
      const normalizedSearch = search
        .trim()
        .slice(0, ADMIN_USERS_SEARCH_MAX_LENGTH);
      return rpc.admin.users.list({
        search: normalizedSearch || undefined,
        page: page + 1,
        limit: ADMIN_USERS_PAGE_SIZE,
      });
    },
    enabled: userId !== "",
    placeholderData: (previousData, previousQuery) =>
      userId !== "" && previousQuery?.queryKey[2] === userId
        ? previousData
        : undefined,
  });
}
