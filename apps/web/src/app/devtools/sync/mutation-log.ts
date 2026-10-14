import { createLog } from "./store";

export type MutationEntry = {
  id: number;
  collection: string;
  kind: "txid" | "match";
  /** The txid; a match predicate cannot be shown, so it reads "match". */
  label: string;
  startedAt: number;
  durationMs: number | undefined;
  outcome: "pending" | "resolved" | "timed-out";
};

export const mutationLog = /* @__PURE__ */ createLog<MutationEntry>();

export const clearMutationLog = mutationLog.clear;
