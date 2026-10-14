import * as Sentry from "@sentry/node";
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { recordWorkspaceLeave } from "#api/activity/index";
import { eventContext } from "#api/platform/event-context";
import { authenticateApiRequest } from "./lib/authenticate-api-request";
import { auth } from "./config";
import { logFailure } from "#api/platform/logger";

type AuthEventIdentity = {
  actorUserId: string;
};

/** Runs Better Auth with its verified principal and records successful leave requests after their membership delete. */
async function dispatchBetterAuthRequest(
  request: Request,
  identity?: AuthEventIdentity,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  let workspaceLeaveId: string | undefined;
  if (
    identity &&
    request.method === "POST" &&
    pathname.endsWith("/auth/organization/leave")
  ) {
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    const parsed = z
      .object({ organizationId: z.string().min(1) })
      .safeParse(body);
    if (parsed.success) workspaceLeaveId = parsed.data.organizationId;
  }

  const dispatch = async () => {
    const response = await auth.handler(request);
    if (response.ok && identity && workspaceLeaveId) {
      await recordWorkspaceLeave({
        workspaceId: workspaceLeaveId,
        userId: identity.actorUserId,
      });
    }
    return response;
  };

  return identity ? eventContext.run(identity, dispatch) : dispatch();
}

/** Better Auth's HTTP API: sign-in, sign-out and session. */
export const authRoutes = new Hono().on(
  ["POST", "GET", "PUT", "PATCH", "DELETE"],
  "/auth/*",
  async (c) => {
    const authHeader = c.req.header("Authorization");
    const bearerToken = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (bearerToken) {
      const headers = new Headers(c.req.raw.headers);
      headers.delete("cookie");
      const session = await auth.api.getSession({ headers });
      if (!session?.session || !session.user) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }
      return dispatchBetterAuthRequest(new Request(c.req.raw, { headers }), {
        actorUserId: session.user.id,
      });
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const actorUserId = session?.user.id;
    if (!actorUserId) return dispatchBetterAuthRequest(c.req.raw);
    return dispatchBetterAuthRequest(c.req.raw, { actorUserId });
  },
);

/**
 * Authenticates every API request that reaches it and runs the rest of the
 * request as that user, so events carry who caused them. MCP and discovery
 * paths authenticate themselves.
 */
export const authenticateApi: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/api/mcp") || path.startsWith("/api/.well-known/")) {
    return next();
  }
  return Sentry.withIsolationScope(async () => {
    Sentry.setUser(null);
    try {
      await authenticateApiRequest(c);
      return await eventContext.run({ actorUserId: c.get("userId") }, next);
    } catch (error) {
      if (!(error instanceof HTTPException)) {
        // The browser gave up (a long-polling shape request cancelled on
        // navigation or sign-out); nobody is waiting for an answer.
        if (c.req.raw.signal.aborted) {
          return new Response(null, { status: 499 });
        }
        logFailure(
          "auth.api-authentication",
          {
            cause: error instanceof Error ? error.message : String(error),
            code: (error as { code?: string }).code,
          },
          error,
        );
        throw new HTTPException(500, { message: "Internal Server Error" });
      }
      throw error;
    } finally {
      Sentry.setUser(null);
    }
  });
};
