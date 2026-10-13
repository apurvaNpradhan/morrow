import { redirect } from "@tanstack/react-router";
import { workspaceUrl } from "@morrow/permissions/workspace-url";
import { rpc } from "@/app/lib/orpc";
import { toNavigation } from "./destination";

/** Where leaving onboarding goes: the original destination, else the workspace just created or joined, else last-used. */
export function getFinishDestination({
  redirectTo,
  workspaceSlug,
}: {
  redirectTo?: string;
  workspaceSlug?: string;
}): string {
  return redirectTo ?? (workspaceSlug ? workspaceUrl(workspaceSlug) : "/");
}

/**
 * Route-guard form: records completion, then redirects to the finish destination.
 */
export async function finishOnboarding({
  redirectTo,
  workspaceSlug,
}: {
  redirectTo?: string;
  workspaceSlug?: string;
}): Promise<never> {
  await rpc.onboarding.complete();
  const destination = getFinishDestination({ redirectTo, workspaceSlug });
  throw redirect({ ...toNavigation(destination), replace: true } as never);
}
