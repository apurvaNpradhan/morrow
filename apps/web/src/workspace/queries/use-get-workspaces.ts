import { useQuery } from "@tanstack/react-query";
import { workspacesQueryOptions } from "./workspaces-query";

export function useGetWorkspaces() {
  const { data, error, isPending } = useQuery(workspacesQueryOptions);

  return {
    data,
    error,
    isLoading: isPending,
    isError: !!error,
  };
}
