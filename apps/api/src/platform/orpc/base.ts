import { ORPCError, os } from "@orpc/server";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";
import { eventContext } from "#api/platform/event-context";
import { hasInstanceAdminRole } from "#api/platform/instance-admin-role";
import { userHasWorkspacePermission } from "#api/platform/permissions";
import { validateWorkspaceAccess } from "#api/platform/validate-workspace-access";

/**
 * What the transport hands every procedure: the raw request headers. The MCP
 * endpoint alone sets `mcpUserId`, in-process, after verifying an OAuth access
 * token; over HTTP the field is never read from the request.
 */
export type RequestContext = { headers: Headers; mcpUserId?: string };

/**
 * Maps Better Auth failures to typed codes. Better Auth answers 401 for a
 * permission denial as well ("not allowed to delete this member"). By then
 * `authed` has verified the session, so a 401 from it is a refusal, not a lost
 * session: reporting it as UNAUTHORIZED would make the clients sign out.
 */
const CODE_BY_STATUS = {
  400: "BAD_REQUEST",
  401: "FORBIDDEN",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
  502: "BAD_GATEWAY",
} as const;

/**
 * The session behind a request, or null. A bearer token is read on its own,
 * never alongside a cookie, as for every other authenticated route.
 */
export function sessionHeaders(headers: Headers) {
  const effective = new Headers(headers);
  if (/^Bearer\s+\S+$/i.test(effective.get("authorization") ?? "")) {
    effective.delete("cookie");
  }
  return effective;
}

/** The valid session, or null when there is none. Throws when it cannot be looked up. */
export async function checkSession(headers: Headers) {
  // Loaded on demand: auth configuration imports the verticals that import
  // this module, so a static import would be a cycle.
  const { auth } = await import("#api/auth/index");
  const session = await auth.api.getSession({
    headers: sessionHeaders(headers),
  });
  return session?.user && session.session ? session : null;
}

/** Like `checkSession`, but a failed lookup counts as no session. */
export async function readSession(headers: Headers) {
  try {
    return await checkSession(headers);
  } catch {
    return null;
  }
}

/**
 * Procedure builder with the instance's typed error codes. Everything else is
 * built from `base` (public) or `authed` (signed-in) so the clients can match
 * on `code` and show a translated message.
 */
export const base = os
  .$context<RequestContext>()
  .errors({
    BAD_REQUEST: {},
    UNAUTHORIZED: { message: "Unauthorized" },
    FORBIDDEN: {},
    NOT_FOUND: {},
    CONFLICT: {},
    TOO_MANY_REQUESTS: {},
    BAD_GATEWAY: {},
  })
  .use(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      // Better Auth failures keep their own code (e.g. INVITATION_EMAIL_FAILED)
      // in `data.code` so the web app can tell them apart.
      if (error instanceof APIError) {
        const code =
          CODE_BY_STATUS[error.statusCode as keyof typeof CODE_BY_STATUS];
        if (code) {
          const authCode = (error.body as { code?: string } | undefined)?.code;
          throw new ORPCError(code, {
            message: error.message,
            data: authCode ? { code: authCode } : undefined,
          });
        }
      }
      throw error;
    }
  });

async function sessionPrincipal(headers: Headers) {
  const session = await readSession(headers);
  if (!session) return null;
  // What Better Auth's server API needs to act as this caller.
  return { user: session.user, authHeaders: sessionHeaders(headers) };
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof readSession>>>["user"];

async function mcpPrincipal(userId: string) {
  // The full row, so `role` and the other plugin fields match a session user.
  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row) return null;
  const user: SessionUser = row;
  // An OAuth token is not a session, so Better Auth endpoints that act as the
  // caller are unavailable to MCP tools.
  return { user, authHeaders: new Headers() };
}

/** Signed-in callers only; adds the user to the context. */
export const authed = base.use(async ({ context, next }) => {
  const principal = context.mcpUserId
    ? await mcpPrincipal(context.mcpUserId)
    : await sessionPrincipal(context.headers);
  if (!principal) throw new ORPCError("UNAUTHORIZED");
  const { user, authHeaders } = principal;
  const userId = user.id;
  return eventContext.run({ actorUserId: userId }, () =>
    next({
      context: {
        user,
        userId,
        authHeaders,
      },
    }),
  );
});

/** Instance administrators only (the `ADMIN_EMAILS` allowlist sets the role). */
export const admin = authed.use(async ({ context, next }) => {
  if (!hasInstanceAdminRole(context.user.role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Instance administrator access is required",
    });
  }
  return next();
});

/** Whether a user holds every action in a workspace; instance admins always do. */
export async function userCan(
  user: { id: string; role?: string | null },
  workspaceId: string,
  permissions: Record<string, string[]>,
) {
  return userHasWorkspacePermission(
    user.id,
    workspaceId,
    permissions,
    hasInstanceAdminRole(user.role),
  );
}

/**
 * Middleware for a procedure whose input carries `workspaceId`. Put it after
 * `.input(...)` so the check runs on validated input: the caller must belong
 * to the workspace (instance admins excepted) and hold every listed action.
 */
export function requireWorkspacePermission(
  permissions: Record<string, string[]>,
) {
  return authed.middleware(
    async ({ context, next }, input: { workspaceId: string }) => {
      await validateWorkspaceAccess(context.userId, input.workspaceId);
      const allowed = await userHasWorkspacePermission(
        context.userId,
        input.workspaceId,
        permissions,
        hasInstanceAdminRole(context.user.role),
      );
      if (!allowed) {
        throw new ORPCError("FORBIDDEN", {
          message: "Insufficient permissions",
        });
      }
      return next();
    },
  );
}
