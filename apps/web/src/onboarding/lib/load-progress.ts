import { listMyWorkspaces, type MyWorkspace } from "@/workspace";
import type { OnboardingProgress } from "./resume-step";

type ProgressUser = { id: string; name?: string | null };

export type LoadedProgress = {
  progress: OnboardingProgress;
  workspaces: MyWorkspace[];
  /** The workspace the invite step is for: the first one this user owns. */
  ownedWorkspace: MyWorkspace | null;
};

/**
 * What an onboarding guard needs to decide where this user belongs. The
 * Workspaces and roles come from the synced collections the layout above has
 * already loaded, so this is a read, not a request.
 */
export async function loadOnboardingProgress(
  user: ProgressUser,
): Promise<LoadedProgress> {
  const workspaces = listMyWorkspaces(user.id);
  const hasName = Boolean(user.name?.trim());
  // Ownership only decides the invite step, which needs a name and a workspace.
  const ownedWorkspace = hasName
    ? (workspaces.find((workspace) =>
        workspace.role.split(",").includes("owner"),
      ) ?? null)
    : null;
  return {
    progress: {
      hasName,
      hasWorkspace: workspaces.length > 0,
      ownsWorkspace: ownedWorkspace !== null,
    },
    workspaces,
    ownedWorkspace,
  };
}
