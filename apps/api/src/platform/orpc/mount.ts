import { onError } from "@orpc/server";
import * as Sentry from "@sentry/node";
import { RPCHandler } from "@orpc/server/fetch";
import type { Env, Hono } from "hono";
import { MAX_IMAGE_REQUEST_BYTES } from "#api/storage/index";
import { MAX_TASK_IMPORT_REQUEST_BYTES } from "#api/tasks/index";
import { boundedRequestBody } from "#api/platform/http/bounded-request-body";
import { requireTrustedOrigin } from "#api/platform/http/require-trusted-origin";
import { appRouter } from "./router";
import { currentRequestLog, log } from "#api/platform/logger";

// Typed failures (ORPCError) are expected; only log the unexpected.
function logUnexpected(error: unknown) {
  if (!(error instanceof Error) || error.name !== "ORPCError") {
    Sentry.captureException(error);
    const request = currentRequestLog();
    if (request) request.error(error instanceof Error ? error : String(error));
    else log.error({ action: "orpc.unexpected" });
  }
}

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logUnexpected)],
});

/**
 * Serves the router over the RPC protocol under /rpc. Unmatched requests fall
 * through to the plain HTTP routes (assets, OAuth, Better Auth).
 */
export function mountOrpc<E extends Env>(app: Hono<E>) {
  // Every procedure is bounded before any parser reads the body, and only the
  // web origin may use the browser's cookie. Image uploads are the largest
  // input, except a task import, which carries a whole document.
  const boundImage = boundedRequestBody(MAX_IMAGE_REQUEST_BYTES);
  const boundTaskImport = boundedRequestBody(MAX_TASK_IMPORT_REQUEST_BYTES);
  app.use("/rpc/*", requireTrustedOrigin());
  app.use("/rpc/*", (c, next) =>
    c.req.path === "/rpc/tasks/import"
      ? boundTaskImport(c, next)
      : boundImage(c, next),
  );
  app.use("/rpc/*", async (c, next) => {
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context: { headers: c.req.raw.headers },
    });
    return matched ? response : next();
  });
}
