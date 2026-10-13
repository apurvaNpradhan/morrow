import { describe, expect, it } from "vite-plus/test";
import {
  encodeWorkspaceActivityCursor,
  parseWorkspaceActivityCursor,
} from "./workspace-activity-cursor";

describe("workspace activity cursors", () => {
  it("round trips a millisecond timestamp and activity ID", () => {
    const cursor = {
      createdAt: new Date("2026-10-08T10:12:13.456Z"),
      id: "activity-123",
    };

    expect(
      parseWorkspaceActivityCursor(encodeWorkspaceActivityCursor(cursor)),
    ).toEqual(cursor);
  });

  it.each([
    "!",
    "",
    "bm90LWEtdGltZXN0YW1wXG5pZA",
    "MjAyNi0wMS0wMVQwMDowMDowMC4wMDBa",
  ])("rejects malformed cursor %s", (input) => {
    expect(parseWorkspaceActivityCursor(input)).toBeNull();
  });
});
