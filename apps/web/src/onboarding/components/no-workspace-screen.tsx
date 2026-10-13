import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { setActiveWorkspace } from "@/workspace";
import { workspaceUrl } from "@morrow/permissions/workspace-url";
import { WorkspaceStep } from "./workspace-step";

/**
 * Join or create, without progress: onboarding is already done, but the user
 * has no workspace (for example after leaving their last one).
 */
export function NoWorkspaceScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <WorkspaceStep
      standalone
      onCreated={async (workspace) => {
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        await setActiveWorkspace(workspace.id);
        await navigate({ to: workspaceUrl(workspace.slug) as never });
      }}
      onJoined={async (slug) => {
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        await navigate({ to: workspaceUrl(slug) as never });
      }}
    />
  );
}
