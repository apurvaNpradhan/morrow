import { ENV } from "varlock/env";
import { resolveApiBaseUrl, resolveApiOrigin } from "./api-url";

/**
 * Build-time public configuration, declared in the root `.env.schema` and
 * validated by varlock's Vite plugin. The only place the web app reads it.
 */
export const env = {
  /** Where the API lives; same-origin unless `VITE_API_URL` is set. */
  apiOrigin: resolveApiOrigin(ENV.VITE_API_URL || undefined),
  apiBaseUrl: resolveApiBaseUrl(ENV.VITE_API_URL || undefined),
  turnstileSiteKey: ENV.VITE_TURNSTILE_SITE_KEY || undefined,
  sentryDsn: ENV.VITE_SENTRY_DSN || undefined,
};
