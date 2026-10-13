import * as Sentry from "@sentry/node";
import { APIError } from "better-auth/api";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "#api/auth/config";

// User is tagged on Sentry's isolation scope; the per-request isolation
// scope is forked by Sentry.withIsolationScope in the api.use("*", ...)
// middleware, so this only affects the in-flight request.
function attachUserToScope(userId: string) {
  Sentry.setUser({ id: userId });
}

function isAuthRejection(error: unknown) {
  if (!(error instanceof APIError)) {
    return false;
  }
  const status = typeof error.statusCode === "number" ? error.statusCode : 0;
  return status >= 400 && status < 500;
}

async function getSession(headers: Headers) {
  try {
    return await auth.api.getSession({ headers });
  } catch (error) {
    if (isAuthRejection(error)) {
      return null;
    }
    throw error;
  }
}

async function getSessionFromBearerOnlyHeaders(c: Context) {
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");

  return getSession(headers);
}

function parseBearerToken(authHeader: string | undefined) {
  if (!authHeader) {
    return { token: null, malformed: false };
  }

  if (!authHeader.match(/^Bearer\b/i)) {
    return { token: null, malformed: false };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { token: null, malformed: true };
  }

  return {
    token: match[1] ?? null,
    malformed: false,
  };
}

export async function authenticateApiRequest(c: Context): Promise<void> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (token) {
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user && sessionResult.session) {
      c.set("user", sessionResult.user);
      c.set("session", sessionResult.session);
      c.set("userId", sessionResult.user.id);
      c.set("userEmail", sessionResult.user.email ?? "");
      attachUserToScope(sessionResult.user.id);
      return;
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await getSession(c.req.raw.headers);
  c.set("user", sessionResult?.user ?? null);
  c.set("session", sessionResult?.session ?? null);
  c.set("userId", sessionResult?.user?.id ?? "");
  c.set("userEmail", sessionResult?.user?.email ?? "");

  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  attachUserToScope(sessionResult.user.id);
}

export async function resolveAssetBearerOrCookie(c: Context): Promise<{
  userId: string;
}> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (token) {
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user?.id) {
      return { userId: sessionResult.user.id };
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await getSession(c.req.raw.headers);
  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return { userId: sessionResult.user.id };
}
