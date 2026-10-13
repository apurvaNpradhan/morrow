import { createFileRoute } from "@tanstack/react-router";
import { InviteTeammatesStep } from "@/onboarding";
import { useFinishOnboarding } from "@/onboarding";
import { loadOnboardingProgress } from "@/onboarding";
import { getResumeStep } from "@/onboarding";
import { redirectToResumeStep } from "@/onboarding";

// Only for someone who owns a workspace they haven't finished onboarding with.
export const Route = createFileRoute(
  "/_layout/_authenticated/onboarding/invite",
)({
  beforeLoad: async ({ context, search }) => {
    if (!context.session) return {};
    const loaded = await loadOnboardingProgress(context.session.user);
    if (getResumeStep(loaded.progress) !== "invite" || !loaded.ownedWorkspace) {
      await redirectToResumeStep(loaded, search.redirect);
    }
    return { workspace: loaded.ownedWorkspace };
  },
  component: InviteRoute,
});

function InviteRoute() {
  const { workspace } = Route.useRouteContext();
  const { redirect: redirectTo } = Route.useSearch();
  const finish = useFinishOnboarding(redirectTo);
  if (!workspace) return null;

  return (
    <InviteTeammatesStep
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      onDone={() => finish(workspace.slug)}
    />
  );
}
