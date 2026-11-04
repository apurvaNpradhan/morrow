import * as encoding from "lib0/encoding";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const logged = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("#api/platform/logger", () => ({
  log: logged,
  logFailure: vi.fn(),
}));

import { createYjsRoutes } from "./yjs-proxy";
import { refusal } from "./yjs-access";

const PATH = "/documents/yjs/w1/docs/d1/g1";

const framed = (...updates: Uint8Array[]) => {
  const encoder = encoding.createEncoder();
  for (const update of updates) encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
};

function proxy(overrides: Partial<Parameters<typeof createYjsRoutes>[0]> = {}) {
  const access = vi.fn().mockResolvedValue(null);
  const checkUpdate = vi.fn().mockResolvedValue(null);
  const routes = createYjsRoutes({
    upstreamUrl: () => "http://upstream.test",
    access,
    checkUpdate,
    ...overrides,
  });
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
    await next();
  });
  app.route("/", routes as never);
  const post = (body: Uint8Array) =>
    app.request(PATH, { method: "POST", body: body as BodyInit });
  return { access, checkUpdate, post };
}

afterEach(() => {
  vi.unstubAllGlobals();
  logged.warn.mockReset();
});

describe("writes through the Yjs proxy", () => {
  it("answers an empty write with 204 itself and never asks the stream", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const { post, access, checkUpdate } = proxy();

    const response = await post(new Uint8Array());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(access).toHaveBeenCalledOnce();
    expect(checkUpdate).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("checks access before it answers an empty write, and refuses an archived page as a 422", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const { post } = proxy({
      access: async () => refusal("DOCUMENT_ARCHIVED", "The page is archived"),
    });

    const response = await post(new Uint8Array());

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "DOCUMENT_ARCHIVED" });
    expect(fetched).not.toHaveBeenCalled();
  });

  it("sends a forbidden write as a 422 that keeps the code, for the producer reads 403 and 409 as protocol steps", async () => {
    const { post } = proxy({
      checkUpdate: async () => refusal("FORBIDDEN", "Not yours"),
    });

    const response = await post(framed(Uint8Array.of(0, 0)));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it("logs a refused update once, but not a rate limit, which carries retry-after", async () => {
    const { post, checkUpdate } = proxy();
    checkUpdate.mockResolvedValueOnce(refusal("INVALID_UPDATE", "No", {}));
    checkUpdate.mockResolvedValue(
      refusal("RATE_LIMITED", "Slow down", { retryAfterSeconds: 2 }),
    );

    await post(framed(Uint8Array.of(0, 0)));
    const limited = await post(framed(Uint8Array.of(0, 0)));
    await post(framed(Uint8Array.of(0, 0)));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("2");
    expect(logged.warn).toHaveBeenCalledTimes(1);
  });
});
