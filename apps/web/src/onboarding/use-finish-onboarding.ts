import { useNavigate } from "@tanstack/react-router";
import { forgetSession } from "@/auth";
import { rpc } from "@/app/lib/orpc";
import { toNavigation } from "./lib/destination";
import { getFinishDestination } from "./lib/finish-onboarding";

/** Records completion and leaves for the original destination or the workspace just set up. */
export function useFinishOnboarding(redirectTo?: string) {
  const navigate = useNavigate();
  return async (workspaceSlug?: string) => {
    await rpc.onboarding.complete();
    forgetSession();
    const destination = getFinishDestination({ redirectTo, workspaceSlug });
    await navigate({ ...toNavigation(destination), replace: true } as never);
  };
}
