import { refreshSession } from "@/auth";
import { rpc } from "@/app/lib/orpc";

/**
 * Records a workspace as the last one used. The session lives in Better Auth's
 * client store, so it is told to refetch or `/` would reopen the previous one.
 */
export async function setActiveWorkspace(workspaceId: string) {
  await rpc.workspace.setActive({ workspaceId });
  refreshSession();
}
