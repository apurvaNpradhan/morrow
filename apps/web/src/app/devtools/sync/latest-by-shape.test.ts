import { describe, expect, it } from "vite-plus/test";
import { latestByShape } from "./latest-by-shape";
import type { RequestEntry } from "./request-log";

const entry = (over: Partial<RequestEntry>): RequestEntry => ({
  id: 1,
  shape: "workspaces",
  startedAt: 1_000,
  durationMs: 50,
  status: 200,
  offset: "-1",
  handle: "h1",
  live: false,
  upToDate: false,
  messages: 0,
  where: null,
  params: null,
  fault: undefined,
  error: undefined,
  ...over,
});

describe("latestByShape", () => {
  it("keeps the newest request and the last time the shape was up to date", () => {
    const states = latestByShape([
      entry({ upToDate: true }),
      entry({ id: 2, startedAt: 5_000, offset: "5_0", live: true }),
    ]);
    expect(states.get("workspaces")).toEqual({
      handle: "h1",
      offset: "5_0",
      live: true,
      lastUpToDate: 1_050,
    });
  });
});
