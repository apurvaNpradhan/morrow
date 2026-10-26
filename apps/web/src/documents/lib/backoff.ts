const FIRST_MS = 1000;
const LONGEST_MS = 15_000;

/**
 * How long a page waits before sending again after a write failed in a way
 * that may pass (a rate limit, a dropped connection). The provider reconnects
 * at once after any producer error, and a client that resent each time would
 * outrun the limit it is waiting for. The wait doubles with each failure and
 * starts over after a write succeeds.
 */
export function createBackoff(now: () => number = Date.now) {
  let delay = 0;
  let until = 0;
  return {
    /** Records a failure; returns the milliseconds to wait. */
    fail(minimumMs = 0): number {
      delay = Math.min(LONGEST_MS, Math.max(minimumMs, delay * 2 || FIRST_MS));
      until = now() + delay;
      return delay;
    },
    succeed() {
      delay = 0;
      until = 0;
    },
    /** Whether sending is on hold. */
    holding(): boolean {
      return now() < until;
    },
  };
}
