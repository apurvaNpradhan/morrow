import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { startBoss } from "../../apps/api/src/platform/jobs/boss";
import { defineQueue } from "../../apps/api/src/platform/jobs/define-queue";
import { stopJobs } from "../../apps/api/src/platform/jobs";
import { resetTestDatabase } from "./helpers/database";
import { waitFor } from "./helpers/wait-for";

// Real pg-boss with a one-second retry delay: the production delivery delay
// (30s with backoff) is too slow to wait for, but the retry rules are shared.
function flakyQueue(name: string, failuresBeforeSuccess: number) {
  const attempts: number[] = [];
  const queue = defineQueue({
    name,
    schema: z.object({ id: z.string() }),
    retryLimit: 2,
    retryDelay: 1,
    retryBackoff: false,
    async handler(_data, context) {
      attempts.push(context.retryCount);
      if (attempts.length <= failuresBeforeSuccess) {
        throw new Error("transient provider failure");
      }
    },
  });
  return { queue, attempts };
}

beforeAll(async () => {
  await resetTestDatabase();
});
afterAll(() => stopJobs());

describe("job retries", () => {
  it("retries a failing job and stops once it succeeds", async () => {
    const { queue, attempts } = flakyQueue("test.retry-then-succeed", 2);
    await queue.work(await startBoss());

    await queue.enqueue({ id: "a" });

    await waitFor(() => (attempts.length >= 3 ? true : null), 20_000);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(attempts).toEqual([0, 1, 2]);
  });

  it("gives up after the retry limit", async () => {
    const { queue, attempts } = flakyQueue("test.retry-exhausted", 99);
    await queue.work(await startBoss());

    await queue.enqueue({ id: "b" });

    await waitFor(() => (attempts.length >= 3 ? true : null), 20_000);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(attempts).toEqual([0, 1, 2]);
  });
});
