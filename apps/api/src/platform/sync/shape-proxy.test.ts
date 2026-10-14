import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
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
