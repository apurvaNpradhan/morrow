import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

const compressor = compress();

/**
 * Compresses responses, except those to a shape's live long-poll (or SSE):
 * they stay open until something changes, and compressing them would hold back
 * every update. A shape's snapshot is finite and by far the largest response,
 * so it is compressed like any other. A page's stream is never compressed: its
 * long-polls and awareness events are live, and its bodies are binary Yjs
 * updates that barely shrink.
 */
export const compressResponses: MiddlewareHandler = (c, next) => {
  const live =
    c.req.query("live") === "true" ||
    c.req.query("live_sse") === "true" ||
    c.req.path.startsWith("/api/documents/yjs/");
  return live ? next() : compressor(c, next);
};
