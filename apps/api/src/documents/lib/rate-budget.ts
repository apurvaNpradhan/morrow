/** How much a user may write to one page: a burst, then a steady rate. */
export type RateLimits = {
  /** Updates per second, and how many may come at once. */
  updatesPerSecond: number;
  updateBurst: number;
  /** Bytes per second, and how many may come at once. */
  bytesPerSecond: number;
  byteBurst: number;
};

/** Typing, pasting and a reload that sends what was kept fit well inside these. */
export const PAGE_WRITE_LIMITS: RateLimits = {
  updatesPerSecond: 20,
  updateBurst: 600,
  bytesPerSecond: 256 * 1024,
  byteBurst: 8 * 1024 * 1024,
};

type Bucket = { updates: number; bytes: number; at: number };

/**
 * A rate budget per (user, page) on updates and bytes, kept in this process's
 * memory. The MCP tools spend from the same budget, so an agent and a person
 * share what one writer may do. A lost budget (a restart) only gives a fresh one.
 */
export function createRateBudget(
  limits: RateLimits = PAGE_WRITE_LIMITS,
  now: () => number = Date.now,
) {
  const buckets = new Map<string, Bucket>();

  return {
    /**
     * Spends one update of `bytes`. Returns the seconds to wait when the
     * budget is spent, or null when the write may go ahead.
     */
    take(userId: string, documentId: string, bytes: number): number | null {
      const key = `${userId}:${documentId}`;
      const time = now();
      const bucket = buckets.get(key) ?? {
        updates: limits.updateBurst,
        bytes: limits.byteBurst,
        at: time,
      };
      const seconds = Math.max(0, (time - bucket.at) / 1000);
      bucket.updates = Math.min(
        limits.updateBurst,
        bucket.updates + seconds * limits.updatesPerSecond,
      );
      bucket.bytes = Math.min(
        limits.byteBurst,
        bucket.bytes + seconds * limits.bytesPerSecond,
      );
      bucket.at = time;
      buckets.set(key, bucket);
      if (buckets.size > 10_000) this.forgetIdle(time);

      if (bucket.updates >= 1 && bucket.bytes >= bytes) {
        bucket.updates -= 1;
        bucket.bytes -= bytes;
        return null;
      }
      const forUpdate = (1 - bucket.updates) / limits.updatesPerSecond;
      const forBytes = (bytes - bucket.bytes) / limits.bytesPerSecond;
      return Math.max(1, Math.ceil(Math.max(forUpdate, forBytes)));
    },

    /** Drops budgets that have refilled completely, which hold nothing. */
    forgetIdle(time: number = now()) {
      const refill = Math.max(
        limits.updateBurst / limits.updatesPerSecond,
        limits.byteBurst / limits.bytesPerSecond,
      );
      for (const [key, bucket] of buckets) {
        if ((time - bucket.at) / 1000 > refill) buckets.delete(key);
      }
    },
  };
}

/** The budget the proxy and the MCP tools share. */
export const pageWriteBudget = createRateBudget();
