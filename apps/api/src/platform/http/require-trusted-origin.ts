import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { config } from "#api/platform/config";

function trustedOrigins() {
  const origins = new Set<string>();
  for (const value of [config.clientUrl, config.apiUrl]) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.trim());
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Invalid entries and wildcards grant nothing.
    }
  }
  return origins;
}

/**
 * Rejects browser requests from other origins. Browsers always send `Origin`
 * on cross-site and POST requests, so an absent header means a native or
 * server client (which has to bring its own credentials); a present one must
 * be this instance's web origin, so a hostile page can't ride the cookie.
 */
export function requireTrustedOrigin(): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("origin");
    if (origin !== undefined && !trustedOrigins().has(origin)) {
      throw new HTTPException(403, { message: "Origin is not allowed" });
    }
    return next();
  };
}
