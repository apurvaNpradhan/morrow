import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { WorkspaceStep } from "@/onboarding";
import { useFinishOnboarding } from "@/onboarding";
import { setActiveWorkspace } from "@/workspace";
import { loadOnboardingProgress } from "@/onboarding";
import { redirectToResumeStep } from "@/onboarding";

export const Route = createFileRoute(
  "/_layout/_authenticated/onboarding/workspace",
)({
  beforeLoad: async ({ context, search }) => {
    if (!context.session) return;
    const loaded = await loadOnboardingProgress(context.session.user);
    if (!loaded.progress.hasName) {
      throw redirect({
        to: "/onboarding/you",
        search: { redirect: search.redirect },
        replace: true,
      });
    }
    // Already in a workspace: move on to whatever is left.
    if (loaded.progress.hasWorkspace) {
      await redirectToResumeStep(loaded, search.redirect);
    }
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const finish = useFinishOnboarding(redirectTo);

  return (
    <WorkspaceStep
      onBack={() =>
        navigate({ to: "/onboarding/you", search: { redirect: redirectTo } })
      }
      onCreated={async (workspace) => {
        await setActiveWorkspace(workspace.id);
        await navigate({
          to: "/onboarding/invite",
          search: { redirect: redirectTo },
          replace: true,
        });
      }}
      onJoined={(slug) => finish(slug)}
    />
  );
}
