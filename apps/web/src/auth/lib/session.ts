import { handleUnauthorized } from "@/app/lib/http-error";
import { localDatabaseWiped } from "@/app/sync/local-database";
import { readOwnerStamp, writeOwnerStamp } from "@/app/sync/owner-stamp";
import { cleanupSyncedCollections } from "@/app/sync/synced-collections";
import { queryClient } from "@/app/query-client";
import { authClient } from "./auth-client";

const SESSION_KEY = ["session"];

const sessionQuery = {
  queryKey: SESSION_KEY,
  queryFn: async () => {
    const { data, error } = await authClient.getSession();
    if (error) throw error;
    return data;
  },
  staleTime: 30_000,
  retry: false,
};

type Session = Awaited<ReturnType<typeof sessionQuery.queryFn>>;

/**
 * The current session, or null when signed out; rejects when the request
 * fails. Better Auth answers a failed request (429, 5xx) with `data: null`
 * rather than throwing, which would read as "signed out", so the error is
 * thrown here and never cached.
 *
 * Route guards ask on every navigation, and `preload: "intent"` runs them on
 * every link hover, so a session already in the cache is returned at once and
 * a stale one is refreshed in the background. Only a cold load waits on the
 * network. A refresh that finds the session gone or another user is treated
 * like a 401.
 */
export async function loadSession(): Promise<Session> {
  const cached = queryClient.getQueryData<Session>(SESSION_KEY);
  if (!cached) {
    const session = await queryClient.fetchQuery(sessionQuery);
    // The local database belongs to the user in the owner stamp; anyone else
    // signing in on this browser starts from an empty one.
    const stamp = readOwnerStamp();
    if (stamp && stamp.userId !== session?.user.id) {
      void cleanupSyncedCollections();
    } else if (stamp && session) {
      writeOwnerStamp(session.user);
    }
    return session;
  }
  void queryClient
    .fetchQuery(sessionQuery)
    .then((fresh) => {
      if (fresh?.user.id !== cached.user.id) {
        forgetSession();
        handleUnauthorized();
      } else if (readOwnerStamp()) {
        // Keep the stamp's copy of the user current (name, onboarding state).
        writeOwnerStamp(fresh.user);
      }
    })
    .catch(() => {
      // Unknown, not signed out: the next request that gets a 401 redirects.
    });
  return cached;
}

/** Drops the cached session; call after anything that changes the user or session. */
export function forgetSession() {
  queryClient.removeQueries({ queryKey: SESSION_KEY });
}

/**
 * On a boot whose browser holds a signed-in user's database, the session cache
 * starts from the owner stamp's copy of that user, so the app renders before
 * the network confirms the session. The first `loadSession` then refreshes it
 * in the background and treats a refusal like a 401.
 */
export function seedSessionFromOwnerStamp() {
  const stamp = readOwnerStamp();
  if (!stamp || localDatabaseWiped()) return;
  if (queryClient.getQueryData(SESSION_KEY)) return;
  queryClient.setQueryData(
    SESSION_KEY,
    { user: stamp.user, session: null },
    { updatedAt: 0 },
  );
}
