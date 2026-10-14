import { beforeEach, describe, expect, it } from "vite-plus/test";
import { clearMutationLog, mutationLog } from "./mutation-log";
import { traceWaits } from "./trace-waits";

beforeEach(clearMutationLog);

function collectionWith(
  utils: Record<string, (...args: never[]) => Promise<unknown>>,
) {
  return { id: "workspace-members", utils } as never;
}

describe("traceWaits", () => {
  it("records a resolved awaitTxId and returns its result", async () => {
    const collection = collectionWith({ awaitTxId: async () => true });
    traceWaits(collection);
    const pending = (
      collection as never as {
        utils: { awaitTxId: (txid: number) => Promise<unknown> };
      }
    ).utils.awaitTxId(42);
    expect(mutationLog.get()[0]).toMatchObject({
      collection: "workspace-members",
      kind: "txid",
      label: "42",
      outcome: "pending",
    });
    expect(await pending).toBe(true);
    expect(mutationLog.get()[0]).toMatchObject({ outcome: "resolved" });
    expect(mutationLog.get()[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a timeout and rethrows the original error", async () => {
    const error = new Error("Timeout waiting for txId");
    const collection = collectionWith({
      awaitMatch: async () => {
        throw error;
      },
    });
    traceWaits(collection);
    await expect(
      (
        collection as never as { utils: { awaitMatch: () => Promise<unknown> } }
      ).utils.awaitMatch(),
    ).rejects.toBe(error);
    expect(mutationLog.get()[0]).toMatchObject({
      kind: "match",
      label: "match",
      outcome: "timed-out",
    });
  });

  it("skips collections without wait utilities", () => {
    expect(() => traceWaits(collectionWith({}))).not.toThrow();
  });
});
