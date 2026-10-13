import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/app/lib/orpc";

export function invalidateWorkspaceHomeQueries(
  queryClient: QueryClient,
  workspaceId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["workspace", "full", workspaceId],
  });
  void queryClient.invalidateQueries({
    queryKey: ["workspace-users", workspaceId],
  });
  void queryClient.invalidateQueries({
    queryKey: orpc.activity.key(),
  });
}
