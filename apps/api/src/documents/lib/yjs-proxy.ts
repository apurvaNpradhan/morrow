import type { User } from "better-auth/types";
import { Hono } from "hono";
import { boundedRequestBody } from "#api/platform/http/bounded-request-body";
import { logFailure } from "#api/platform/logger";
import { decodeFramedUpdates } from "./yjs-frames";
import type {
  YjsAccessCheck,
  YjsRefusal,
  YjsTarget,
  YjsUpdateCheck,
} from "./yjs-access";

/** The `YjsServer` service every page lives under. */
export const YJS_SERVICE = "morrow";

/** A page update is at most 1 MB; the rest is lib0 framing and a batch's length prefixes. */
export const YJS_MAX_REQUEST_BYTES = 1024 * 1024 + 16 * 1024;

/**
 * An awareness connection is closed after this long, and the provider
 * reconnects through the access check again. A removed member loses their
 * presence stream within it.
 */
export const AWARENESS_MAX_MS = 60_000;

const ID = /^[a-z0-9]{1,64}$/;
const GENERATION = /^g([1-9]\d{0,8})$/;

const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "producer-id",
  "producer-epoch",
  "producer-seq",
  "stream-seq",
];
const DROPPED_RESPONSE_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
];

export type YjsProxyDependencies = {
  /** Where `YjsServer` listens, read per request. */
  upstreamUrl: () => string;
  access: YjsAccessCheck;
  checkUpdate: YjsUpdateCheck;
  awarenessMaxMs?: number;
};

type Variables = { Variables: { userId: string; user: User | null } };

const refusal = (r: YjsRefusal) =>
  Response.json({ code: r.code, message: r.message }, { status: r.status });

const invalid = (message: string) =>
  refusal({ status: 400, code: "INVALID_REQUEST", message });

function parseTarget(params: Record<string, string>): YjsTarget | null {
  const generation = GENERATION.exec(params.generation ?? "")?.[1];
  const { workspaceId, docId } = params;
  if (!generation || !workspaceId || !docId) return null;
  if (!ID.test(workspaceId) || !ID.test(docId)) return null;
  return { workspaceId, docId, generation: Number(generation) };
}

/** Ends the body after `ms` and aborts the upstream request it came from. */
function closeAfter(
  body: ReadableStream<Uint8Array>,
  ms: number,
  abort: () => void,
) {
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setTimeout(() => {
        if (closed) return;
        closed = true;
        abort();
        controller.close();
      }, ms);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (closed) return;
        if (done) {
          closed = true;
          clearTimeout(timer);
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        controller.error(error);
      }
    },
    cancel(reason) {
      closed = true;
      clearTimeout(timer);
      abort();
      return reader.cancel(reason);
    },
  });
}

/**
 * The only way the browser reaches `YjsServer`. It checks the session's access
 * to the page on every request, forwards the protocol's reads and writes, and
 * hands each decoded update to `checkUpdate` before it is forwarded. The
 * browser cannot create or delete a page's stream here: a PUT only asks
 * whether it exists.
 */
export function createYjsRoutes(dependencies: YjsProxyDependencies) {
  const { upstreamUrl, access, checkUpdate } = dependencies;
  const awarenessMaxMs = dependencies.awarenessMaxMs ?? AWARENESS_MAX_MS;
  const routes = new Hono<Variables>();
  const path = "/documents/yjs/:workspaceId/docs/:docId/:generation";

  const boundWrites = boundedRequestBody(YJS_MAX_REQUEST_BYTES);
  routes.use(path, (c, next) =>
    c.req.method === "POST" ? boundWrites(c, next) : next(),
  );

  routes.all(path, async (c) => {
    const target = parseTarget(c.req.param());
    if (!target) {
      return refusal({
        status: 404,
        code: "DOCUMENT_NOT_FOUND",
        message: "There is no such page",
      });
    }
    const method = c.req.method;
    const url = new URL(c.req.url);
    const awareness = url.searchParams.get("awareness");
    const live = url.searchParams.get("live");
    const isWrite = method === "POST";
    if (!["GET", "HEAD", "POST", "PUT"].includes(method)) {
      return new Response(null, { status: 405 });
    }
    // Page updates are long-polled, so each poll is checked again; only the
    // awareness stream may be a long-lived SSE connection.
    if (awareness !== null && awareness !== "default") {
      return invalid("Only the default awareness stream exists");
    }
    if (
      live === "sse"
        ? awareness === null
        : live !== null && live !== "long-poll"
    ) {
      return invalid("Page updates are read by long-poll");
    }

    const userId = c.get("userId");
    const request = {
      userId,
      target,
      mode: isWrite ? "write" : "read",
    } as const;
    const denied = await access(request);
    if (denied) return refusal(denied);

    const upstream = new URL(
      `/v1/yjs/${YJS_SERVICE}/docs/${target.docId}/g${target.generation}`,
      upstreamUrl(),
    );
    upstream.search = url.search;

    let body: Uint8Array<ArrayBuffer> | undefined;
    if (isWrite) {
      body = new Uint8Array(await c.req.arrayBuffer());
      let updates: Uint8Array[];
      try {
        updates = decodeFramedUpdates(body);
      } catch {
        return refusal({
          status: 400,
          code: "INVALID_UPDATE",
          message: "The update is not framed",
        });
      }
      for (const update of updates) {
        const rejected = await checkUpdate({
          ...request,
          kind: awareness === null ? "document" : "awareness",
          update,
        });
        if (rejected) return refusal(rejected);
      }
    }

    // A PUT only asks whether the page's stream exists; creating it is the
    // server's job (`documents.create`).
    const forwardedMethod = method === "PUT" ? "HEAD" : method;
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = c.req.header(name);
      if (value !== undefined) headers.set(name, value);
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    c.req.raw.signal.addEventListener("abort", abort, { once: true });
    let response: Response;
    try {
      response = await fetch(upstream, {
        method: forwardedMethod,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
      logFailure("documents.yjs-upstream", { docId: target.docId }, error);
      return Response.json(
        { code: "UNAVAILABLE", message: "Pages are unavailable" },
        { status: 503 },
      );
    }

    const out = new Headers(response.headers);
    for (const name of DROPPED_RESPONSE_HEADERS) out.delete(name);
    const location = response.headers.get("location");
    if (location) {
      out.set(
        "location",
        `${url.pathname}${new URL(location, upstream).search}`,
      );
    }

    if (method === "PUT") {
      void response.body?.cancel();
      return new Response(null, {
        status: response.ok ? 200 : response.status,
        headers: out,
      });
    }
    let stream: BodyInit | null = response.body;
    if (response.body && awareness !== null && live !== null) {
      stream = closeAfter(response.body, awarenessMaxMs, abort);
    }
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    });
  });

  return routes;
}
