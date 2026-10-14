import { mutationLog } from "./mutation-log";

type Wait = (...args: unknown[]) => Promise<unknown>;

/**
 * Wraps a collection's `awaitTxId` and `awaitMatch` so each wait is logged with
 * how it ended. The result or error reaches the caller unchanged.
 */
export function traceWaits(collection: { id: string; utils: object }) {
  const utils = collection.utils as Record<string, Wait | undefined>;
  const wrap = (
    name: "awaitTxId" | "awaitMatch",
    kind: "txid" | "match",
    label: (args: unknown[]) => string,
  ) => {
    const original = utils[name];
    if (!original) return;
    utils[name] = async (...args) => {
      const id = mutationLog.nextId();
      const startedAt = Date.now();
      mutationLog.push({
        id,
        collection: collection.id,
        kind,
        label: label(args),
        startedAt,
        durationMs: undefined,
        outcome: "pending",
      });
      try {
        const result = await original.apply(utils, args);
        mutationLog.update(id, {
          outcome: "resolved",
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        mutationLog.update(id, {
          outcome: "timed-out",
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }
    };
  };
  wrap("awaitTxId", "txid", ([txid]) => String(txid));
  wrap("awaitMatch", "match", () => "match");
}
