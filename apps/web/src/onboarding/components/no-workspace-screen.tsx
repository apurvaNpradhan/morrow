import { useNavigate } from "@tanstack/react-router";
import { setActiveWorkspace } from "@/workspace";
import { workspaceUrl } from "@morrow/permissions/workspace-url";
import { WorkspaceStep } from "./workspace-step";

/**
 * Join or create, without progress: onboarding is already done, but the user
 * has no workspace (for example after leaving their last one).
 */
export function NoWorkspaceScreen() {
  const navigate = useNavigate();

  return (
    <WorkspaceStep
      standalone
      onCreated={async (workspace) => {
        await setActiveWorkspace(workspace.id);
        await navigate({ to: workspaceUrl(workspace.slug) as never });
      }}
      onJoined={async (slug) => {
        await navigate({ to: workspaceUrl(slug) as never });
      }}
    />
  );
}
