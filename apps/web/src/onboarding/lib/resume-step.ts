export type OnboardingStep = "you" | "workspace" | "invite";

export type OnboardingProgress = {
  hasName: boolean;
  hasWorkspace: boolean;
  /** Owns a workspace, so the optional invite step applies. */
  ownsWorkspace: boolean;
};

/**
 * Where an unfinished onboarding should continue, or "complete" when only the
 * completion call is left. The You step counts as done only once the user also
 * has a workspace, so a name supplied by a sign-in provider is still
 * confirmed once.
 */
export function getResumeStep({
  hasName,
  hasWorkspace,
  ownsWorkspace,
}: OnboardingProgress): OnboardingStep | "complete" {
  if (!hasWorkspace) return hasName ? "workspace" : "you";
  if (!hasName) return "you";
  return ownsWorkspace ? "invite" : "complete";
}
