import * as Sentry from "@sentry/node";
import type { Session, User } from "better-auth/types";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { ORPCError } from "@orpc/server";
import { HTTPException } from "hono/http-exception";
import { evlog, type EvlogVariables } from "evlog/hono";
import { authenticateApi, authRoutes } from "#api/auth/index";
import { mcpRoutes, mcpWellKnownRoutes } from "#api/mcp/index";
import { storageRoutes } from "#api/storage/index";
import { healthRoutes } from "./health";
import { clientIpMiddleware } from "./http/client-ip";
import { requestLoggingOptions } from "./logger";
import { mountOrpc } from "./orpc/mount";
import { serveWebApp } from "./serve-web-app";

type AppVariables = {
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
  };
};

type ApiVariables = {
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    userEmail: string;
  };
};

const httpStatusByCode = new Map(
  Object.entries({
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
  }),
);

/** Assembles the HTTP app: plain routes, the oRPC handlers and the web app. */
export function createApp() {
  const app = new Hono<AppVariables & EvlogVariables>();
  app.use("*", clientIpMiddleware());
  app.use("*", evlog(requestLoggingOptions));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // expected errors (401/404/...) are not reported; real failures are
      if (err.status >= 500) {
        Sentry.captureException(err);
      }
      return err.getResponse();
    }

    // Domain code throws ORPCError even when an HTTP route (assets) calls it.
    if (err instanceof ORPCError) {
      const status = httpStatusByCode.get(err.code) ?? 500;
      if (status >= 500) Sentry.captureException(err);
      return c.json({ code: err.code, message: err.message }, status as 400);
    }

    Sentry.captureException(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });
  app.use(compress());

  const api = new Hono<ApiVariables>();

  // Routes that authorize themselves, or are public, come before the shared
  // authentication below.
  api.route("/", healthRoutes);
  api.route("/", storageRoutes);
  api.route("/", authRoutes);
  api.route("/", mcpRoutes);

  api.use("*", authenticateApi);

  app.route("/", mcpWellKnownRoutes);

  mountOrpc(app);
  app.route("/api", api);
  serveWebApp(app);

  return {
    app,
    api,
  };
}
