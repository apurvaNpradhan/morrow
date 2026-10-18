import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTrackSignup } from "@/app/hooks/use-track-signup";
import {
  myInvitationCollection,
  workspaceInvitationCollection,
  workspaceMemberCollection,
  workspaceMemberUserCollection,
} from "@/members";
import { projectCollection, projectColumnCollection } from "@/projects";
import {
  useLeaveLostWorkspace,
  workspaceCollection,
  WorkspaceError,
} from "@/workspace";
import { loadSyncedCollection } from "@/app/sync/synced-collections";
import {
  localPersistence,
  localDatabaseWiped,
} from "@/app/sync/local-database";
import { readOwnerStamp, writeOwnerStamp } from "@/app/sync/owner-stamp";
import { loadSession } from "@/auth";
import { needsOnboarding } from "@/onboarding";
import { getOnboardingReturnTo } from "@/onboarding";

// protects all child routes, must be logged in
export const Route = createFileRoute("/_layout/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: async ({ location }) => {
    let session = null;
    let sessionError = false;
    try {
      session = await loadSession();
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
    // This page wiped its local database (another account signed in, or a
    // session ended): its collections cannot start again, a new page can.
    if (session && localDatabaseWiped()) {
      window.location.assign(location.href);
      return new Promise<never>(() => {});
    }
    // Onboarding only guides the web app; an unknown session never sends
    // anyone into it, and the API does not enforce it.
    if (session && needsOnboarding(session.user, location.pathname)) {
      throw redirect({
        to: "/onboarding",
        search: { redirect: getOnboardingReturnTo(location) },
      });
    }
    // What the pages after this one read: the user's Workspaces, their own
    // memberships and the invitations sent to them. Without a session there is
    // nothing to sync. The Workspace page's shapes are scoped by membership,
    // not by slug, so they start now too instead of after the redirect to
    // `/$slug`; its loader then waits on syncs already under way.
    if (session) {
      for (const collection of [
        workspaceMemberUserCollection,
        workspaceInvitationCollection,
        projectCollection,
        projectColumnCollection,
      ]) {
        void loadSyncedCollection(collection);
      }
      await Promise.all([
        loadSyncedCollection(workspaceCollection),
        loadSyncedCollection(workspaceMemberCollection),
        loadSyncedCollection(myInvitationCollection),
      ]);
      // The first sync as this user is done: from now on this browser's
      // database is theirs and the next boot renders from it.
      if (localPersistence && !readOwnerStamp()) writeOwnerStamp(session.user);
    }
    return { session, sessionError };
  },
  errorComponent: WorkspaceError,
});

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext();
  useTrackSignup(session?.user);
  useLeaveLostWorkspace();
  return <Outlet />;
}
