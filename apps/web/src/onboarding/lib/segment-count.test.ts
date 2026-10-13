import { describe, expect, it } from "vite-plus/test";
import { getSegmentCount } from "./segment-count";

describe("getSegmentCount", () => {
  it("shows three segments by default", () => {
    expect(getSegmentCount("create")).toBe(3);
  });

  it("collapses to two once Join is chosen", () => {
    expect(getSegmentCount("join")).toBe(2);
  });

  it("shows no progress bar for the single invite-link step", () => {
    expect(getSegmentCount("invite-link")).toBe(0);
  });
});
