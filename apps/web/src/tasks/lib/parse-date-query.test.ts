import { describe, expect, it } from "vite-plus/test";
import { parseDateQuery } from "./parse-date-query";

// Saturday 2026-10-17.
const TODAY = "2026-10-17";

describe("parseDateQuery", () => {
  it.each([
    ["today", "2026-10-17"],
    ["Tomorrow", "2026-10-18"],
    ["yesterday", "2026-10-16"],
    ["fri", "2026-10-23"],
    ["friday", "2026-10-23"],
    ["sun", "2026-10-18"],
    ["sat", "2026-10-24"],
    ["next fri", "2026-10-30"],
    ["in 3 days", "2026-10-20"],
    ["in 1 day", "2026-10-18"],
    ["in 2 weeks", "2026-10-31"],
    ["in 1 month", "2026-11-17"],
    ["2026-11-03", "2026-11-03"],
    ["nov 3", "2026-11-03"],
    ["3 nov", "2026-11-03"],
    ["November 3", "2026-11-03"],
    ["  NOV   3 ", "2026-11-03"],
    ["oct 17", "2026-10-17"],
    ["jan 5", "2027-01-05"],
    ["oct 1", "2027-10-01"],
  ])("%s → %s", (query, expected) => {
    expect(parseDateQuery(query, TODAY)).toBe(expected);
  });

  it("clamps month arithmetic to the month's end", () => {
    expect(parseDateQuery("in 1 month", "2026-01-31")).toBe("2026-02-28");
  });

  it.each([
    "",
    "foo",
    "in -1 days",
    "feb 30",
    "2026-02-30",
    "fr",
    "nov",
    "13 13",
  ])("rejects %j", (query) => {
    expect(parseDateQuery(query, TODAY)).toBeNull();
  });
});
