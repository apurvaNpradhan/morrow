import { queryClient } from "@/app/query-client";
import { authClient } from "./auth-client";

const SESSION_KEY = ["session"];

/**
 * The current session (`data` is null when signed out); rejects when the
 * request fails. Route guards ask on every navigation, and `preload: "intent"`
 * runs them on every link hover, so a short-lived cache keeps that to one
 * request.
 */
export function loadSession() {
  return queryClient.fetchQuery({
    queryKey: SESSION_KEY,
    queryFn: () => authClient.getSession(),
    staleTime: 30_000,
  });
}

/** Drops the cached session; call after anything that changes the user or session. */
export function forgetSession() {
  queryClient.removeQueries({ queryKey: SESSION_KEY });
}
