import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { compressResponses } from "#api/platform/http/compress-responses";
import { shapeRoutes } from "./shape-proxy";

// The real registry imports the verticals, and through them auth and the database.
vi.mock("./shapes", () => ({
  shapeRegistry: new Map([
    [
      "workspace-members",
      {
        name: "workspace-members",
        table: "member",
        columns: ["id", "role"],
        where: ({ userId }: { userId: string }) => ({
          sql: "workspace_id IN (SELECT workspace_id FROM member WHERE user_id = $1)",
          params: [userId],
        }),
      },
    ],
  ]),
}));

function appFor(userId: string) {
  return new Hono<{ Variables: { userId: string; userEmail: string } }>()
    .use(async (c, next) => {
      c.set("userId", userId);
      c.set("userEmail", "ada@example.com");
      await next();
    })
    .route("/", shapeRoutes);
}

function stubElectric() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response("[]", { headers: { "electric-offset": "0_0" } }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("shape proxy dev headers", () => {
  it("reports the resolved filter in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubElectric();
    const response = await appFor("user-1").request(
      "/shapes/workspace-members",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-morrow-shape-where")).toContain("$1");
    expect(
      JSON.parse(response.headers.get("x-morrow-shape-params") ?? ""),
    ).toContain("user-1");
  });

  it.each(["production", "test"])("sends no filter in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    stubElectric();
    const response = await appFor("user-1").request(
      "/shapes/workspace-members",
    );
    expect(response.headers.get("x-morrow-shape-where")).toBeNull();
    expect(response.headers.get("x-morrow-shape-params")).toBeNull();
  });
});

describe("shape response compression", () => {
  const rows = JSON.stringify(
    Array.from({ length: 500 }, (_, id) => ({ id, title: "A task title" })),
  );

  function request(path: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(rows, { headers: { "electric-offset": "0_0" } }),
      ),
    );
    return new Hono<{ Variables: { userId: string; userEmail: string } }>()
      .use(async (c, next) => {
        c.set("userId", "user-1");
        c.set("userEmail", "ada@example.com");
        await next();
      })
      .use(compressResponses)
      .route("/", shapeRoutes)
      .request(path, { headers: { "accept-encoding": "gzip" } });
  }

  it("compresses a snapshot", async () => {
    const response = await request("/shapes/workspace-members?offset=-1");
    expect(response.headers.get("content-encoding")).toBe("gzip");
  });

  it("leaves a live long-poll uncompressed", async () => {
    const response = await request(
      "/shapes/workspace-members?offset=0_0&handle=h&live=true",
    );
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(await response.text()).toBe(rows);
  });
});
