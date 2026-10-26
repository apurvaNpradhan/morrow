import { DurableStreamTestServer } from "@durable-streams/server";
import { YjsProvider } from "@durable-streams/y-durable-streams";
import { YjsServer } from "@durable-streams/y-durable-streams/server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as encoding from "lib0/encoding";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import type { YjsAccessCheck } from "../../apps/api/src/documents/lib/yjs-access";
import { createYjsRoutes } from "../../apps/api/src/documents/lib/yjs-proxy";
import { createPageStream } from "../../apps/api/src/documents/lib/yjs-streams";
import { waitFor } from "./helpers/wait-for";

const WORKSPACE = "ws1";
const DOC = "page1";
const PATH = `${WORKSPACE}/docs/${DOC}/g1`;
const AWARENESS_CAP_MS = 1_000;

let streams: DurableStreamTestServer;
let yjs: YjsServer;
let proxy: ReturnType<typeof serve>;
let origin: string;
let yjsBase: string;
/** The test-only "page": who may read and write it, changed per case. */
const members = new Set(["ada", "grace"]);
const readers = new Set<string>();

const access: YjsAccessCheck = async ({ userId, target, mode }) => {
  if (target.docId !== DOC || target.workspaceId !== WORKSPACE) {
    return { status: 404, code: "DOCUMENT_NOT_FOUND", message: "no page" };
  }
  if (members.has(userId) || (mode === "read" && readers.has(userId))) {
    return null;
  }
  return { status: 403, code: "FORBIDDEN", message: "not a member" };
};

beforeAll(async () => {
  streams = new DurableStreamTestServer({ port: 0 });
  const streamsUrl = await streams.start();
  yjs = new YjsServer({ port: 0, dsServerUrl: streamsUrl });
  const yjsUrl = await yjs.start();

  const app = new Hono<{ Variables: { userId: string } }>();
  // The session is faked: the real one is covered by the 401 case below.
  app.use("*", async (c, next) => {
    const user = c.req.header("x-test-user");
    if (!user) return c.json({ code: "UNAUTHORIZED" }, 401);
    c.set("userId", user);
    return next();
  });
  app.route(
    "/api",
    createYjsRoutes({
      upstreamUrl: () => yjsUrl,
      access,
      checkUpdate: async () => null,
      awarenessMaxMs: AWARENESS_CAP_MS,
    }),
  );
  await new Promise<void>((resolve) => {
    proxy = serve(
      { fetch: app.fetch, port: 0, hostname: "127.0.0.1" },
      (info) => {
        origin = `http://127.0.0.1:${info.port}`;
        resolve();
      },
    );
  });

  // The server creates the page's stream, as `documents.create` will.
  const seed = new Y.Doc();
  seed.getText("t").insert(0, "seed:");
  yjsBase = yjsUrl;
  expect(
    await createPageStream(
      yjsUrl,
      { docId: DOC, generation: 1 },
      Y.encodeStateAsUpdate(seed),
    ),
  ).toBe(true);
});

afterAll(async () => {
  proxy?.close();
  await yjs?.stop();
  await streams?.stop();
});

function client(user: string) {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const provider = new YjsProvider({
    doc,
    awareness,
    baseUrl: `${origin}/api/documents/yjs/${WORKSPACE}`,
    docId: `${DOC}/g1`,
    liveMode: "long-poll",
    headers: { "x-test-user": user },
  });
  provider.on("error", () => {});
  return { doc, awareness, provider };
}

const text = (doc: Y.Doc) => doc.getText("t").toString();

describe("the Yjs proxy", () => {
  it("lets two clients converge through it", async () => {
    const a = client("ada");
    const b = client("grace");
    try {
      await waitFor(() =>
        a.provider.synced && b.provider.synced ? true : null,
      );

      // Both start from what the server put in the stream.
      expect(text(a.doc)).toBe("seed:");
      expect(text(b.doc)).toBe("seed:");

      a.doc.getText("t").insert(5, "hello");
      await waitFor(() => (text(b.doc) === "seed:hello" ? true : null));
      b.doc.getText("t").insert(10, " world");
      await waitFor(() => (text(a.doc) === "seed:hello world" ? true : null));

      a.awareness.setLocalStateField("user", { name: "Ada" });
      await waitFor(() =>
        [...b.awareness.getStates().values()].some(
          (state) =>
            (state as { user?: { name: string } }).user?.name === "Ada",
        )
          ? true
          : null,
      );
      expect(text(a.doc)).toBe(text(b.doc));
    } finally {
      a.provider.destroy();
      b.provider.destroy();
    }
  });

  it("creates a stream once and leaves an existing one alone", async () => {
    const target = { docId: "page2", generation: 1 };

    expect(await createPageStream(yjsBase, target)).toBe(true);
    expect(await createPageStream(yjsBase, target, Uint8Array.of(1, 2))).toBe(
      false,
    );
  });

  it("refuses an anonymous request", async () => {
    const { app } = createApp();
    const response = await app.request(
      `/api/documents/yjs/${PATH}?offset=snapshot`,
    );

    expect(response.status).toBe(401);
  });

  it("refuses a user who is not a member, and a page of another Workspace", async () => {
    const stranger = await fetch(
      `${origin}/api/documents/yjs/${PATH}?offset=-1`,
      { headers: { "x-test-user": "mallory" } },
    );
    expect(stranger.status).toBe(403);
    expect(await stranger.json()).toMatchObject({ code: "FORBIDDEN" });

    const elsewhere = await fetch(
      `${origin}/api/documents/yjs/other/docs/${DOC}/g1?offset=-1`,
      { headers: { "x-test-user": "ada" } },
    );
    expect(elsewhere.status).toBe(404);
  });

  it("lets a reader read but not write", async () => {
    readers.add("viewer");
    try {
      const read = await fetch(
        `${origin}/api/documents/yjs/${PATH}?offset=-1`,
        { headers: { "x-test-user": "viewer" } },
      );
      expect(read.status).toBe(200);

      const write = await fetch(`${origin}/api/documents/yjs/${PATH}`, {
        method: "POST",
        headers: {
          "x-test-user": "viewer",
          "content-type": "application/octet-stream",
        },
        body: new Uint8Array([1, 0]),
      });
      expect(write.status).toBe(403);
    } finally {
      readers.delete("viewer");
    }
  });

  it("refuses a body over the limit", async () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint8Array(
      encoder,
      new Uint8Array(1024 * 1024 + 20 * 1024),
    );
    const response = await fetch(`${origin}/api/documents/yjs/${PATH}`, {
      method: "POST",
      headers: {
        "x-test-user": "ada",
        "content-type": "application/octet-stream",
      },
      body: encoding.toUint8Array(encoder),
    });

    expect(response.status).toBe(413);
  });

  it("refuses a body that is not lib0 framed", async () => {
    const response = await fetch(`${origin}/api/documents/yjs/${PATH}`, {
      method: "POST",
      headers: {
        "x-test-user": "ada",
        "content-type": "application/octet-stream",
      },
      body: new Uint8Array([200, 1]),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_UPDATE" });
  });

  it("does not let the browser remove or create a stream", async () => {
    const remove = await fetch(`${origin}/api/documents/yjs/${PATH}`, {
      method: "DELETE",
      headers: { "x-test-user": "ada" },
    });
    expect(remove.status).toBe(405);

    // The page check passes for the id; the stream of generation 2 does not exist.
    const missing = await fetch(
      `${origin}/api/documents/yjs/${WORKSPACE}/docs/${DOC}/g2`,
      { method: "PUT", headers: { "x-test-user": "ada" } },
    );
    expect(missing.status).toBe(404);
  });

  it("reads page updates by long-poll only", async () => {
    const response = await fetch(
      `${origin}/api/documents/yjs/${PATH}?offset=now&live=sse`,
      { headers: { "x-test-user": "ada" } },
    );

    expect(response.status).toBe(400);
  });

  it("closes an awareness connection after the cap", async () => {
    const started = Date.now();
    const response = await fetch(
      `${origin}/api/documents/yjs/${PATH}?awareness=default&offset=now&live=sse`,
      { headers: { "x-test-user": "ada" } },
    );
    expect(response.status).toBe(200);

    await response.body!.pipeTo(new WritableStream());

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(AWARENESS_CAP_MS - 100);
    expect(elapsed).toBeLessThan(AWARENESS_CAP_MS + 4_000);
  });

  it("stops serving a removed member from the next poll", async () => {
    const a = client("ada");
    const b = client("grace");
    try {
      await waitFor(() =>
        a.provider.synced && b.provider.synced ? true : null,
      );
      const write = (value: string) =>
        a.doc.getText("t").insert(a.doc.getText("t").length, value);
      write("one");
      await waitFor(() => (text(b.doc).endsWith("one") ? true : null));

      members.delete("grace");
      // The poll already open when access ended may still carry one update.
      write("-two");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      write("-three");
      await new Promise((resolve) => setTimeout(resolve, 3_000));

      expect(text(b.doc)).not.toContain("three");
      expect(text(a.doc).endsWith("one-two-three")).toBe(true);
    } finally {
      members.add("grace");
      a.provider.destroy();
      b.provider.destroy();
    }
  });
});
