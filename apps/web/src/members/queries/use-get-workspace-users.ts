import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type GetWorkspaceUsersRequest = {
  workspaceId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterOperator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";
  filterValue?: string;
};

export function useGetWorkspaceUsers({
  workspaceId,
  ...paging
}: GetWorkspaceUsersRequest) {
  return useQuery({
    queryKey: [
      "workspace-users",
      workspaceId,
      paging.limit,
      paging.offset,
      paging.sortBy,
      paging.sortDirection,
      paging.filterField,
      paging.filterOperator,
      paging.filterValue,
    ],
    enabled: !!workspaceId,
    queryFn: () => {
      if (!workspaceId) throw new Error("A workspace is required");
      return rpc.members.page({ workspaceId, ...paging });
    },
  });
}
