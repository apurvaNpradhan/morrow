import { authClient } from "./auth-client";

// Route guards ask for the session on every navigation, and `preload: "intent"`
// runs them on every link hover. A short-lived cache keeps that to one request.
const FRESH_FOR_MS = 30_000;

let cached: {
  at: number;
  session: ReturnType<typeof authClient.getSession>;
} | null = null;

/** The current session (`data` is null when signed out); rejects when the request fails. */
export function loadSession() {
  if (!cached || Date.now() - cached.at > FRESH_FOR_MS) {
    const session = authClient.getSession();
    cached = { at: Date.now(), session };
    // A failed request must not be served from the cache next time.
    session.catch(() => {
      if (cached?.session === session) cached = null;
    });
  }
  return cached.session;
}

/** Drops the cached session; call after anything that changes the user or session. */
export function forgetSession() {
  cached = null;
}
