import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { YouStep } from "@/onboarding";
import { useFinishOnboarding } from "@/onboarding";
import { loadOnboardingProgress } from "@/onboarding";
import { redirectToResumeStep } from "@/onboarding";

export const Route = createFileRoute("/_layout/_authenticated/onboarding/you")({
  beforeLoad: async ({ context, search }) => {
    if (!context.session) return {};
    const loaded = await loadOnboardingProgress(context.session.user);
    // Named and in a workspace: nothing left to ask here.
    if (loaded.progress.hasName && loaded.progress.hasWorkspace) {
      await redirectToResumeStep(loaded, search.redirect);
    }
    return {
      hasWorkspace: loaded.progress.hasWorkspace,
      workspaceSlug: loaded.workspaces[0]?.slug,
    };
  },
  component: YouRoute,
});

function YouRoute() {
  const { session } = Route.useRouteContext();
  const { hasWorkspace, workspaceSlug } = Route.useRouteContext();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const finish = useFinishOnboarding(redirect);
  const email = session?.user.email ?? "";

  return (
    <YouStep
      initialName={session?.user.name ?? ""}
      emailLocalPart={email.split("@")[0] ?? ""}
      // Joining through an invitation leaves the name as the only step.
      isSingleStep={Boolean(hasWorkspace)}
      onDone={() =>
        hasWorkspace
          ? finish(workspaceSlug)
          : navigate({ to: "/onboarding/workspace", search: { redirect } })
      }
    />
  );
}
