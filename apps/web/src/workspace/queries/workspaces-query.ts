import { queryOptions } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export const workspacesQueryOptions = queryOptions({
  queryKey: ["workspaces"],
  queryFn: () => rpc.workspace.list(),
});
