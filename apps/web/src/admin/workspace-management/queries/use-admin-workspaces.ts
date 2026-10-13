import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { rpc } from "@/app/lib/orpc";
import {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
} from "@/admin/lib/admin-types";

export {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
  type AdminWorkspace,
} from "@/admin/lib/admin-types";

export const ADMIN_WORKSPACES_QUERY_KEY = ["admin", "workspaces"] as const;

export function useAdminWorkspaces(search: string, page: number) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_WORKSPACES_QUERY_KEY, userId, search.trim(), page],
    queryFn: () => {
      const normalizedSearch = search
        .trim()
        .slice(0, ADMIN_WORKSPACES_SEARCH_MAX_LENGTH);
      return rpc.admin.workspaces.list({
        search: normalizedSearch || undefined,
        page: page + 1,
        limit: ADMIN_WORKSPACES_PAGE_SIZE,
      });
    },
    enabled: userId !== "",
    placeholderData: (previousData, previousQuery) =>
      userId !== "" && previousQuery?.queryKey[2] === userId
        ? previousData
        : undefined,
  });
}
