import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTrackSignup } from "@/app/hooks/use-track-signup";
import { authClient } from "@/auth";
import { needsOnboarding } from "@/onboarding";
import { getOnboardingReturnTo } from "@/onboarding";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: async ({ location }) => {
    let session = null;
    let sessionError = false;
    try {
      const { data } = await authClient.getSession();
      session = data;
    } catch (error) {
      sessionError = true;
      if (import.meta.env.DEV) console.warn("getSession failed", error);
      // getSession() rejected (e.g. network error) — session state is
      // unknown. Don't conflate with "no session" (unauthenticated): let
      // children decide whether to skip active-organization mutations.
    }
    if (!session && !sessionError) {
      throw redirect({
        to: "/auth/sign-in",
        search: {
          // location.href is pathname + search + hash without the origin.
          // location.search is a null-prototype parsed object, so string
          // concatenation on it throws "Cannot convert object to primitive value".
          redirect: location.href,
        },
      });
    }
    // Onboarding only guides the web app; an unknown session never sends
    // anyone into it, and the API does not enforce it.
    if (session && needsOnboarding(session.user, location.pathname)) {
      throw redirect({
        to: "/onboarding",
        search: { redirect: getOnboardingReturnTo(location) },
      });
    }
    return { session, sessionError };
  },
});

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext();
  useTrackSignup(session?.user);
  return <Outlet />;
}
