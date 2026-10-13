import { authClient } from "./auth-client";

/** Makes the session store refetch after the API changed the user or session. */
export function refreshSession() {
  authClient.$store.notify("$sessionSignal");
}
