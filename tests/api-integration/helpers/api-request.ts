import { ORPCError } from "@orpc/client";
import { createApp } from "../../../apps/api/src/index";
import { createTestClient } from "./orpc";

type Client = ReturnType<typeof createTestClient>;
type Init = { method?: string; body?: unknown };
type Route = {
  method: string;
  pattern: RegExp;
  call: (
    client: Client,
    match: string[],
    url: URL,
    body: any,
  ) => Promise<unknown>;
};

const STATUS_BY_CODE: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
};

const num = (value: string | null) =>
  value === null ? undefined : Number(value);

/**
 * The route-shaped calls these tests make, as procedure calls. Procedures are
 * served over /rpc only; a path that is not listed goes to the plain HTTP app.
 */
const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/workspace\/slug-availability$/,
    call: (c, _m, url) =>
      c.workspace.slugAvailability({
        slug: url.searchParams.get("slug") ?? "",
        workspaceId: url.searchParams.get("workspaceId") ?? undefined,
      }),
  },
  {
    method: "GET",
    pattern: /^\/workspace\/by-slug\/([^/]+)$/,
    call: (c, m) => c.workspace.resolve({ slug: m[1]! }),
  },
  {
    method: "PUT",
    pattern: /^\/workspace\/([^/]+)\/slug$/,
    call: (c, m, _u, body) =>
      c.workspace.renameSlug({ workspaceId: m[1]!, slug: body.slug }),
  },
  {
    method: "GET",
    pattern: /^\/admin\/workspaces$/,
    call: (c, _m, url) =>
      c.admin.workspaces.list({
        search: url.searchParams.get("search") ?? undefined,
        page: num(url.searchParams.get("page")),
        limit: num(url.searchParams.get("limit")),
      }),
  },
  {
    method: "GET",
    pattern: /^\/admin\/workspaces\/([^/]+)\/roles$/,
    call: (c, m) => c.admin.workspaces.roles({ workspaceId: m[1]! }),
  },
  {
    method: "PUT",
    pattern: /^\/admin\/workspaces\/([^/]+)\/owner$/,
    call: (c, m, _u, body) =>
      c.admin.workspaces.transferOwnership({
        workspaceId: m[1]!,
        userId: body.userId,
      }),
  },
  {
    method: "POST",
    pattern: /^\/admin\/workspaces\/([^/]+)\/members$/,
    call: (c, m, _u, body) =>
      c.admin.workspaces.addMember({
        workspaceId: m[1]!,
        userId: body.userId,
        role: body.role,
      }),
  },
  {
    method: "PUT",
    pattern: /^\/admin\/workspaces\/([^/]+)\/members\/([^/]+)\/role$/,
    call: (c, m, _u, body) =>
      c.admin.workspaces.updateMemberRole({
        workspaceId: m[1]!,
        userId: m[2]!,
        role: body.role,
      }),
  },
  {
    method: "DELETE",
    pattern: /^\/admin\/workspaces\/([^/]+)\/members\/([^/]+)$/,
    call: (c, m) =>
      c.admin.workspaces.removeMember({ workspaceId: m[1]!, userId: m[2]! }),
  },
];

export function apiRequest(headers: Record<string, string> = {}) {
  const { app } = createApp();
  const client = createTestClient(app, headers);
  return async (path: string, init: Init = {}): Promise<Response> => {
    const method = init.method ?? "GET";
    const url = new URL(path, "http://localhost");
    for (const route of routes) {
      const match = route.method === method && route.pattern.exec(url.pathname);
      if (!match) continue;
      try {
        return Response.json(
          (await route.call(client, [...match], url, init.body ?? {})) ?? null,
        );
      } catch (error) {
        const code = error instanceof ORPCError ? error.code : "";
        return Response.json({ code }, { status: STATUS_BY_CODE[code] ?? 500 });
      }
    }
    return app.request(`/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  };
}
