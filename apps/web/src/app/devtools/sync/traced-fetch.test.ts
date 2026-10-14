import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { faults, resetFaults } from "./faults";
import { clearRequestLog, requestLog } from "./request-log";
import { tracedFetch } from "./traced-fetch";

const url = "https://morrow.test/api/shapes/workspaces";

function electricResponse(headers: Record<string, string> = {}, body = "[]") {
  return new Response(body, {
    headers: { "electric-handle": "h1", "electric-offset": "5_0", ...headers },
  });
}

beforeEach(() => {
  clearRequestLog();
  resetFaults();
});
afterEach(() => vi.useRealTimers());

describe("tracedFetch", () => {
  it("logs the request and the Electric and proxy headers", async () => {
    const base = vi.fn(async () =>
      electricResponse(
        {
          "electric-up-to-date": "",
          "x-morrow-shape-where": "user_id = $1",
          "x-morrow-shape-params": '["u1"]',
        },
        '[{"headers":{}},{"headers":{}}]',
      ),
    );
    const response = await tracedFetch(
      "workspaces",
      base,
    )(`${url}?offset=-1&handle=h0`);
    expect(await response.json()).toHaveLength(2);
    await vi.waitFor(() => expect(requestLog.get()).toHaveLength(1));
    expect(requestLog.get()[0]).toMatchObject({
      shape: "workspaces",
      status: 200,
      offset: "-1",
      handle: "h1",
      live: false,
      upToDate: true,
      messages: 2,
      where: "user_id = $1",
      params: '["u1"]',
    });
  });

  it("logs a live request without reading its body", async () => {
    const response = electricResponse();
    const clone = vi.spyOn(response, "clone");
    await tracedFetch(
      "workspaces",
      async () => response,
    )(`${url}?offset=5_0&live=true`);
    expect(requestLog.get()[0]).toMatchObject({
      live: true,
      messages: undefined,
    });
    expect(clone).not.toHaveBeenCalled();
  });

  it("answers an armed status fault once, without the network", async () => {
    const base = vi.fn(async () => electricResponse());
    const traced = tracedFetch("workspaces", base);
    faults.arm({ shape: "workspaces", status: 401 });

    expect((await traced(url)).status).toBe(401);
    expect(base).not.toHaveBeenCalled();
    expect(requestLog.get()[0]).toMatchObject({ status: 401, fault: "401" });

    expect((await traced(url)).status).toBe(200);
    expect(base).toHaveBeenCalledOnce();
  });

  it("leaves other shapes alone, and an 'any' fault hits the next one", async () => {
    const base = vi.fn(async () => electricResponse());
    faults.arm({ shape: "workspace-members", status: 500 });
    expect((await tracedFetch("workspaces", base)(url)).status).toBe(200);
    faults.arm({ shape: "any", status: 403 });
    expect((await tracedFetch("workspaces", base)(url)).status).toBe(403);
  });

  it("fails like a network error while offline, until turned off", async () => {
    const base = vi.fn(async () => electricResponse());
    const traced = tracedFetch("workspaces", base);
    faults.setOffline(true);
    await expect(traced(url)).rejects.toBeInstanceOf(TypeError);
    await expect(traced(url)).rejects.toBeInstanceOf(TypeError);
    expect(requestLog.get()[0]).toMatchObject({ fault: "offline" });
    faults.setOffline(false);
    expect((await traced(url)).status).toBe(200);
  });

  it("delays requests while latency is on", async () => {
    vi.useFakeTimers();
    const base = vi.fn(async () => electricResponse());
    faults.setLatency(3_000);
    const pending = tracedFetch("workspaces", base)(url);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(base).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(base).toHaveBeenCalledOnce();
  });

  it("logs a request that fails before any response, and rethrows", async () => {
    const failure = new TypeError("Failed to fetch");
    const base = vi.fn(async () => {
      throw failure;
    });
    await expect(tracedFetch("workspaces", base)(url)).rejects.toBe(failure);
    expect(requestLog.get()[0]).toMatchObject({
      status: 0,
      error: "Failed to fetch",
    });
  });

  it("prefers a fault armed for the shape over one armed for any", async () => {
    faults.arm({ shape: "any", status: 500 });
    faults.arm({ shape: "workspaces", status: 401 });
    const traced = tracedFetch("workspaces", async () => electricResponse());
    expect((await traced(url)).status).toBe(401);
    expect((await traced(url)).status).toBe(500);
  });

  it("keeps the last 200 entries", async () => {
    const traced = tracedFetch("workspaces", async () => electricResponse());
    for (let i = 0; i < 205; i++) await traced(`${url}?live=true&offset=${i}`);
    expect(requestLog.get()).toHaveLength(200);
    expect(requestLog.get()[0]?.offset).toBe("5");
  });
});

describe("faults", () => {
  it("restores latency and offline from sessionStorage, not armed faults", () => {
    faults.setLatency(1_500);
    faults.setOffline(true);
    faults.arm({ shape: "any", status: 500 });
    faults.restore();
    expect(faults.get()).toMatchObject({
      latencyMs: 1_500,
      offline: true,
      armed: [],
    });
  });

  it("still works when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => faults.setOffline(true)).not.toThrow();
    expect(() => faults.restore()).not.toThrow();
    vi.restoreAllMocks();
  });
});
