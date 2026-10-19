import { browserTracingIntegration, init } from "@sentry/react";
import { env } from "./env";
import { whenIdle } from "./when-idle";

const dsn = env.sentryDsn;

if (dsn) {
  init({
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
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
    ignoreErrors: [
      // Thrown by Safari browser extensions on iOS 18+ injecting content scripts;
      // not caused by morrow code.
      "Invalid call to runtime.sendMessage()",
      // Thrown by Facebook's in-app browser (Android) navigation performance logger
      // calling postMessage on a destroyed WebView Java bridge; not caused by morrow code.
      "Error invoking postMessage: Java object is gone",
    ],
    denyUrls: [
      // Errors from third-party affiliate/adware browser extensions that inject
      // scripts fetching from rsc.cdn77.org (e.g. domainList.json); not caused by morrow code.
      /cdn77\.org/,
    ],
    // Safari's "Load failed" used to be filtered here by message alone, which
    // also silenced actionable TanStack Query fetch failures. The query client
    // already rate-limits network errors via its own cooldown; auth-provider
    // tags its transient session-fetch errors so we can drop only those here.
    beforeSend(event) {
      if (event.tags?.area === "auth.session") return null;
      return event;
    },
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  // Session replay is a large chunk and is not needed to paint, so it joins
  // once the browser is idle after the first paint.
  whenIdle(() => {
    void import("./start-session-replay").then((m) => m.startSessionReplay());
  });
}
