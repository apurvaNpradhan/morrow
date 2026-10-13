export type OnboardingPath = "create" | "join" | "invite-link";

/** Progress segments for a path: three by default, two once Join is chosen, none for the single invite-link step. */
export function getSegmentCount(path: OnboardingPath): number {
  if (path === "invite-link") return 0;
  return path === "join" ? 2 : 3;
}
