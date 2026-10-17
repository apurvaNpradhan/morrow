import { handleUnauthorized } from "@/app/lib/http-error";
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
  if (!cached) return queryClient.fetchQuery(sessionQuery);
  void queryClient
    .fetchQuery(sessionQuery)
    .then((fresh) => {
      if (fresh?.user.id !== cached.user.id) {
        forgetSession();
        handleUnauthorized();
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
