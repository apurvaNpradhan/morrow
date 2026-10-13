import { redirect } from "@tanstack/react-router";
import { finishOnboarding } from "./finish-onboarding";
import type { LoadedProgress } from "./load-progress";
import { getResumeStep } from "./resume-step";

/**
 * Throws a redirect to wherever this user's unfinished onboarding continues,
 * completing it on the spot when only that is left.
 */
export async function redirectToResumeStep(
  loaded: LoadedProgress,
  redirectTo: string | undefined,
): Promise<never> {
  const step = getResumeStep(loaded.progress);
  if (step === "complete") {
    return finishOnboarding({
      redirectTo,
      workspaceSlug: loaded.workspaces[0]?.slug,
    });
  }
  throw redirect({
    to: `/onboarding/${step}`,
    search: { redirect: redirectTo },
    replace: true,
  });
}
