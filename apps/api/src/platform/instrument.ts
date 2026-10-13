import { readFileSync } from "node:fs";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { config } from "./config";

function readAppVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

const sentry = config.sentry;

if (sentry.dsn) {
  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release ?? readAppVersion(),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    tracesSampleRate: sentry.tracesSampleRate,
    profileSessionSampleRate: sentry.profilesSampleRate,
    profileLifecycle: "trace",
    integrations: [nodeProfilingIntegration()],
  });
}
