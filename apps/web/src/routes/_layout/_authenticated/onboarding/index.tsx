import { createFileRoute } from "@tanstack/react-router";
import { loadOnboardingProgress } from "@/onboarding";
import { redirectToResumeStep } from "@/onboarding";

// Resumes at the first step that isn't finished.
export const Route = createFileRoute("/_layout/_authenticated/onboarding/")({
  beforeLoad: async ({ context, search }) => {
    if (!context.session) return;
    const loaded = await loadOnboardingProgress(context.session.user);
    await redirectToResumeStep(loaded, search.redirect);
  },
});
