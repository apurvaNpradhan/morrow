import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";
import { config } from "#api/platform/config";
import { requireTrustedOrigin } from "./require-trusted-origin";

const app = new Hono();
app.use("*", requireTrustedOrigin());
app.post("/", (c) => c.text("ok"));

const post = (origin?: string) =>
  app.request("/", { method: "POST", headers: origin ? { origin } : {} });

describe("requireTrustedOrigin", () => {
  it("accepts the web origin and requests without an Origin header", async () => {
    expect((await post(new URL(config.clientUrl).origin)).status).toBe(200);
    expect((await post()).status).toBe(200);
  });

  it("rejects other, null and lookalike origins", async () => {
    const trusted = new URL(config.clientUrl);
    for (const origin of [
      "https://evil.example",
      "null",
      `${trusted.protocol}//${trusted.host}.evil.example`,
      `${trusted.origin}:1`,
    ]) {
      expect((await post(origin)).status).toBe(403);
    }
  });
});
