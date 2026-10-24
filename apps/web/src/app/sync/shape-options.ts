import { FetchError, snakeCamelMapper } from "@electric-sql/client";
import * as Sentry from "@sentry/react";
import { env } from "@/app/lib/env";
import { tracedFetch } from "@/app/devtools/sync/traced-fetch";
import { handleUnauthorized } from "@/app/lib/http-error";
import { forgetSession, loadSession } from "@/auth";

// The parser's result type has to match the collection's schema, which differs
// per collection, so its dates are typed `never`: assignable to any of them.
const parser = {
  timestamptz: (value: string) => new Date(value) as never,
  // `timestamp` has no zone; the server runs in UTC.
  timestamp: (value: string) =>
    new Date(`${value.replace(" ", "T")}Z`) as never,
} satisfies Record<string, (value: string) => never>;

// When the last refused shape request was retried; a second refusal soon after
// is not a blip.
let retriedUnauthorizedAt = 0;

/**
 * Whether a shape's 401 means the user is signed out. A request refused while
 * the tab was hidden or the connection dropped is not proof of that, so the
 * session is asked for again; a session that is still there earns one retry.
 */
async function isSignedOut() {
  if (Date.now() - retriedUnauthorizedAt < 10_000) return true;
  forgetSession();
  const session = await loadSession().catch(() => undefined);
  if (session === null) return true;
  retriedUnauthorizedAt = Date.now();
  return false;
}

/**
 * The options every synced collection shares. The browser asks Morrow's
 * `/api/shapes/:name` for a shape by name; the server decides the table,
 * columns and rows (see the shape registry in the API).
 */
export function shapeOptions(name: string, replica?: "full") {
  return {
    url: `${env.apiBaseUrl}/shapes/${name}`,
    // Tells the collection that updates carry whole rows. The server decides
    // what Electric sends; it never reads this parameter.
    ...(replica && { params: { replica } }),
    columnMapper: snakeCamelMapper(),
    parser,
    // Development only: logs shape requests and applies the devtools' faults.
    ...(import.meta.env.DEV && { fetchClient: tracedFetch(name) }),
    // Electric retries 5xx and network errors with its own backoff before it
    // asks us; what reaches here is a refusal.
    onError: async (error: Error) => {
      if (error instanceof FetchError && error.status === 401) {
        if (!(await isSignedOut())) return {};
        handleUnauthorized();
        return;
      }
      if (
        error instanceof FetchError &&
        (error.status === 403 || error.status === 404)
      ) {
        Sentry.captureException(error, { tags: { area: "sync.shape" } });
        return;
      }
      return {};
    },
  };
}
