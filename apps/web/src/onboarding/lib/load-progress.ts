import { rpc } from "@/app/lib/orpc";
import type { OnboardingProgress } from "./resume-step";

type ProgressUser = { id: string; name?: string | null };

export type LoadedProgress = {
  progress: OnboardingProgress;
  workspaces: Awaited<ReturnType<typeof rpc.workspace.list>>;
  /** The workspace the invite step is for: the first one this user owns. */
  ownedWorkspace: Awaited<ReturnType<typeof rpc.workspace.list>>[number] | null;
};

async function findOwnedWorkspace(workspaces: LoadedProgress["workspaces"]) {
  for (const workspace of workspaces) {
    const member = await rpc.members.current({ workspaceId: workspace.id });
    const role = member?.role;
    if (typeof role === "string" && role.split(",").includes("owner"))
      return workspace;
  }
  return null;
}

/** Reads what an onboarding guard needs to decide where this user belongs. */
export async function loadOnboardingProgress(
  user: ProgressUser,
): Promise<LoadedProgress> {
  const workspaces = await rpc.workspace.list();
  const hasName = Boolean(user.name?.trim());
  // Ownership only decides the invite step, which needs a name and a workspace.
  const ownedWorkspace =
    hasName && workspaces.length > 0
      ? await findOwnedWorkspace(workspaces)
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
