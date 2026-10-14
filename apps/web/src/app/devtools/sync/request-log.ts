import { createLog } from "./store";

export type RequestEntry = {
  id: number;
  shape: string;
  startedAt: number;
  durationMs: number;
  status: number;
  offset: string | null;
  handle: string | null;
  live: boolean;
  upToDate: boolean;
  /** Messages in the response; unknown for live requests, which are not read. */
  messages: number | undefined;
  /** The filter the proxy resolved for this user (development only). */
  where: string | null;
  params: string | null;
  /** Set when the devtools answered instead of the network. */
  fault: string | undefined;
  /** Set when the request failed before any response (network error). */
  error: string | undefined;
};

export const requestLog = /* @__PURE__ */ createLog<RequestEntry>();

export const clearRequestLog = requestLog.clear;
