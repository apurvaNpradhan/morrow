import { queryClient } from "@/app/query-client";
import { authClient } from "./auth-client";

const SESSION_KEY = ["session"];

/**
 * The current session, or null when signed out; rejects when the request
 * fails. Better Auth answers a failed request (429, 5xx) with `data: null`
 * rather than throwing, which would read as "signed out", so the error is
 * thrown here and never cached. Route guards ask on every navigation, and
 * `preload: "intent"` runs them on every link hover, so a short-lived cache
 * keeps that to one request.
 */
export function loadSession() {
  return queryClient.fetchQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
}

/** Drops the cached session; call after anything that changes the user or session. */
export function forgetSession() {
  queryClient.removeQueries({ queryKey: SESSION_KEY });
}
