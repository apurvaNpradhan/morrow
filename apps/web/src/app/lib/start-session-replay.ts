import { addIntegration, replayIntegration } from "@sentry/react";

/** Kept in its own module so the replay code is a separate, lazy chunk. */
export function startSessionReplay() {
  addIntegration(replayIntegration());
}
