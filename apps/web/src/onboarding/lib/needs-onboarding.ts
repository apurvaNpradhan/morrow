type OnboardingUser = { onboardingCompletedAt?: Date | string | null };

const ONBOARDING_PATH = /^\/onboarding(\/|$)/;

/** Whether a signed-in user must be sent into onboarding before reaching `pathname`. */
export function needsOnboarding(
  user: OnboardingUser,
  pathname: string,
): boolean {
  return !user.onboardingCompletedAt && !ONBOARDING_PATH.test(pathname);
}
