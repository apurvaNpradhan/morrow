import { authClient } from "./auth-client";
import { forgetSession } from "./session";

/** Makes the session store refetch after the API changed the user or session. */
export function refreshSession() {
  forgetSession();
  authClient.$store.notify("$sessionSignal");
}
