import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Env, Hono } from "hono";

/** The built web app sits next to the API in the image and in the workspace. */
export const WEB_DIST_DIR = fileURLToPath(
  new URL("../../web/dist", import.meta.url),
);

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * Serves the built web app from the API's own origin: static files, with a
 * single-page-app fallback to index.html for client-side routes. API, auth and
 * discovery paths are never answered with the app, and source maps never leave
 * the server. A no-op when the web app has not been built (development, where
 * Vite serves it).
 */
export function serveWebApp<E extends Env>(
  app: Hono<E>,
  distDir = WEB_DIST_DIR,
) {
  const indexFile = join(distDir, "index.html");
  if (!existsSync(indexFile)) return;
  const indexHtml = readFileSync(indexFile, "utf8");

  const isReserved = (path: string) =>
    path === "/api" ||
    path.startsWith("/api/") ||
    path.startsWith("/.well-known/");

  app.use("*", async (c, next) => {
    if (isReserved(c.req.path) || !["GET", "HEAD"].includes(c.req.method)) {
      return next();
    }
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "SAMEORIGIN");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (c.req.path.endsWith(".map")) return c.notFound();
    await next();
    // Hashed build assets never change; everything else is revalidated.
    if (c.res.status === 200 && !c.res.headers.has("Cache-Control")) {
      c.res.headers.set(
        "Cache-Control",
        c.req.path.startsWith("/assets/") ? IMMUTABLE : "no-cache",
      );
    }
  });

  app.use("*", serveStatic({ root: distDir }));

  app.get("*", (c) => {
    // Unknown files are 404s; only extensionless client routes get the app.
    if (isReserved(c.req.path) || /\.[a-z0-9]+$/i.test(c.req.path)) {
      return c.notFound();
    }
    c.header("Cache-Control", "no-cache");
    return c.html(indexHtml);
  });
}
