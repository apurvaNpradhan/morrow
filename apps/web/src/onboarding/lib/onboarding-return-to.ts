/**
 * The location to come back to after onboarding. The bare entry points carry
 * no intent, so finishing lands in the workspace just set up instead.
 */
export function getOnboardingReturnTo(location: {
  href: string;
  pathname: string;
}): string | undefined {
  return ["/"].includes(location.pathname.replace(/\/+$/, "") || "/")
    ? undefined
    : location.href;
}
