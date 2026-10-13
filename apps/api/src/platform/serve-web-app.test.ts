import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { serveWebApp } from "./serve-web-app";

let dist: string;

function appFor(directory = dist) {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  serveWebApp(app, directory);
  return app;
}

beforeEach(() => {
  dist = mkdtempSync(path.join(tmpdir(), "morrow-web-"));
  mkdirSync(path.join(dist, "assets"));
  writeFileSync(path.join(dist, "index.html"), "<html>app</html>");
  writeFileSync(path.join(dist, "assets", "app-abc123.js"), "console.log(1)");
  writeFileSync(path.join(dist, "assets", "app-abc123.js.map"), "{}");
  writeFileSync(path.join(dist, "robots.txt"), "User-agent: *");
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

describe("serveWebApp", () => {
  it("serves files with caching suited to their kind", async () => {
    const app = appFor();
    const asset = await app.request("/assets/app-abc123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
    const robots = await app.request("/robots.txt");
    expect(robots.headers.get("cache-control")).toBe("no-cache");
    expect(await robots.text()).toBe("User-agent: *");
  });

  it("falls back to the app for client-side routes", async () => {
    const app = appFor();
    for (const route of ["/", "/acme/settings", "/auth/sign-in"]) {
      const response = await app.request(route);
      expect(response.status, route).toBe(200);
      expect(await response.text()).toBe("<html>app</html>");
      expect(response.headers.get("cache-control")).toBe("no-cache");
    }
  });

  it("sets security headers on app responses", async () => {
    const response = await appFor().request("/");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("never answers API or discovery paths with the app", async () => {
    const app = appFor();
    expect(
      (await app.request("/api/health")).headers.get("content-type"),
    ).toContain("json");
    expect((await app.request("/api/nope")).status).toBe(404);
    expect((await app.request("/.well-known/anything")).status).toBe(404);
  });

  it("404s unknown files and never serves source maps", async () => {
    const app = appFor();
    expect((await app.request("/missing.js")).status).toBe(404);
    expect((await app.request("/assets/app-abc123.js.map")).status).toBe(404);
  });

  it("does nothing when the web app is not built", async () => {
    const app = appFor(path.join(dist, "nope"));
    expect((await app.request("/")).status).toBe(404);
  });
});
