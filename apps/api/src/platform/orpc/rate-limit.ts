import { ORPCError } from "@orpc/server";
import { authed } from "./base";

/** Per-user fixed-window limiter held in process memory (no Redis dependency). */
export function rateLimit({
  windowMs,
  max,
}: {
  windowMs: number;
  max: number;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return authed.middleware(async ({ context, next }) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [key, entry] of hits)
        if (entry.resetAt <= now) hits.delete(key);
    }
    const entry = hits.get(context.userId);
    if (!entry || entry.resetAt <= now) {
      hits.set(context.userId, { count: 1, resetAt: now + windowMs });
    } else if (++entry.count > max) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many requests",
      });
    }
    return next();
  });
}
