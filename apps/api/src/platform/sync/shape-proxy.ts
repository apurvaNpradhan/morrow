import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client";
import type { User } from "better-auth/types";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { config } from "#api/platform/config";
import { shapeRegistry } from "./shapes";

/**
 * The only way the browser reaches Electric. The browser names a shape and
 * sends Electric's protocol parameters (offset, handle, live…); the table,
 * columns and filter come from the shape registry and the session, and the
 * secret is added here. Nothing else in the query string is forwarded.
 */
export const shapeRoutes = new Hono<{
  Variables: { userId: string; userEmail: string; user: User | null };
}>().get("/shapes/:name", async (c) => {
  const shape = shapeRegistry.get(c.req.param("name"));
  if (!shape) throw new HTTPException(404, { message: "Unknown shape" });

  const { url, secret } = config.electric;
  const upstream = new URL("/v1/shape", url);
  for (const [key, value] of new URL(c.req.url).searchParams) {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      upstream.searchParams.set(key, value);
    }
  }

  const filter = shape.where({
    userId: c.get("userId"),
    verifiedEmail: c.get("user")?.emailVerified ? c.get("userEmail") : "",
  });
  upstream.searchParams.set("table", shape.table);
  upstream.searchParams.set("columns", shape.columns.join(","));
  upstream.searchParams.set("where", filter.sql);
  filter.params.forEach((value, index) => {
    upstream.searchParams.set(`params[${index + 1}]`, value);
  });
  upstream.searchParams.set("secret", secret);

  const response = await fetch(upstream, { signal: c.req.raw.signal });
  // fetch() already decoded the body, so the original encoding and length no
  // longer describe it.
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  // The devtools show why a shape returns what it does. The filter holds the
  // user's id and email, so it never leaves the server outside development.
  if (config.isDevelopment) {
    headers.set("x-morrow-shape-where", filter.sql);
    headers.set("x-morrow-shape-params", JSON.stringify(filter.params));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
