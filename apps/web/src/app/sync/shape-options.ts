import { FetchError, snakeCamelMapper } from "@electric-sql/client";
import * as Sentry from "@sentry/react";
import { env } from "@/app/lib/env";
import { tracedFetch } from "@/app/devtools/sync/traced-fetch";
import { handleUnauthorized } from "@/app/lib/http-error";

// The parser's result type has to match the collection's schema, which differs
// per collection, so its dates are typed `never`: assignable to any of them.
const parser = {
  timestamptz: (value: string) => new Date(value) as never,
  // `timestamp` has no zone; the server runs in UTC.
  timestamp: (value: string) =>
    new Date(`${value.replace(" ", "T")}Z`) as never,
} satisfies Record<string, (value: string) => never>;

/**
 * The options every synced collection shares. The browser asks Morrow's
 * `/api/shapes/:name` for a shape by name; the server decides the table,
 * columns and rows (see the shape registry in the API).
 */
export function shapeOptions(name: string) {
  return {
    url: `${env.apiBaseUrl}/shapes/${name}`,
    columnMapper: snakeCamelMapper(),
    parser,
    // Development only: logs shape requests and applies the devtools' faults.
    ...(import.meta.env.DEV && { fetchClient: tracedFetch(name) }),
    // Electric retries 5xx and network errors with its own backoff before it
    // asks us; what reaches here is a refusal.
    onError: (error: Error) => {
      if (error instanceof FetchError && error.status === 401) {
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
