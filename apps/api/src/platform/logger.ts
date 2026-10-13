import * as Sentry from "@sentry/node";
import { createRequestLogger, initLogger, log } from "evlog";
import type { DrainContext, RequestLogger } from "evlog";
import { useLogger as getRequestLogger } from "evlog/hono";
import { createDrainPipeline } from "evlog/pipeline";
import { createSentryDrain } from "evlog/sentry";
import { config } from "./config";

const sentry = config.sentry;

// Batches wide events for Sentry Logs. Only exists when Sentry is configured;
// stdout is always on.
const sentryDrain = sentry.dsn
  ? createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
    })(
      createSentryDrain({
        dsn: sentry.dsn,
        environment: sentry.environment,
        release: sentry.release,
      }),
    )
  : undefined;

initLogger({
  env: {
    service: "morrow-api",
    environment: sentry.environment,
    version: sentry.release,
  },
  // Built-in patterns (emails, IPs, JWTs, bearer tokens) are a backstop. What
  // may go into an event is decided at the call site: see the logging rules in
  // AGENTS.md.
  redact: true,
  drain: sentryDrain,
});

/**
 * Hono middleware options. Events keep only an error's name, code and
 * status, on stdout and in Sentry Logs alike: messages and stacks can quote
 * driver queries or provider responses. Report the error itself with
 * `Sentry.captureException`, which is configured not to collect request data.
 */
export const requestLoggingOptions = {
  exclude: ["/api/health"],
  enrich: ({ event }: { event: Record<string, unknown> }) => {
    const error = event.error;
    if (error && typeof error === "object") {
      const { name, code, status } = error as Record<string, unknown>;
      event.error = { name, code, status };
    }
  },
};

export { log };

/** The current request's wide event, when called inside a request. */
export function currentRequestLog() {
  try {
    return getRequestLogger();
  } catch {
    return undefined;
  }
}

/**
 * Records a handled failure. Inside a request it joins the request's wide
 * event and raises its level; elsewhere it is a standalone error event. Fields
 * are IDs, names and codes only. Pass `error` only when its message is safe to
 * report: it goes to Sentry, never into the event.
 */
export function logFailure(
  action: string,
  fields: Record<string, unknown> = {},
  error?: unknown,
) {
  if (error !== undefined) Sentry.captureException(error, { tags: { action } });
  const request = currentRequestLog();
  if (request) {
    request.setLevel("error");
    request.set({ failure: { action, ...fields } });
  } else {
    log.error({ action, ...fields });
  }
}

/**
 * Runs one background job (cron tick, queue drain) as a single wide event.
 * The job sets what it knows on `event`; failures are recorded and rethrown.
 */
export async function runLoggedJob<T>(
  name: string,
  job: (event: RequestLogger) => Promise<T>,
): Promise<T> {
  const event = createRequestLogger({ method: "JOB", path: `/jobs/${name}` });
  event.set({ job: name });
  try {
    return await job(event);
  } catch (error) {
    event.error(error instanceof Error ? error : String(error));
    throw error;
  } finally {
    event.emit();
  }
}

/** Sends pending events to Sentry Logs; call before the process exits. */
export async function flushLogs() {
  await sentryDrain?.flush();
}
