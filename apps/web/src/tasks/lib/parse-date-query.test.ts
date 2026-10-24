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
    ["7 days", "2026-10-24"],
    ["2w", "2026-10-31"],
    ["24h", "2026-10-18"],
    ["25 hours", "2026-10-19"],
    ["3d", "2026-10-20"],
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
    expect(parseDateQuery(query, TODAY)).toEqual({ day: expected });
  });

  it.each([
    ["fri 3pm", "2026-10-23", "15:00"],
    ["tomorrow 09:00", "2026-10-18", "09:00"],
    ["nov 3 3:30pm", "2026-11-03", "15:30"],
    ["in 3 days at 9am", "2026-10-20", "09:00"],
    ["friday 12am", "2026-10-23", "00:00"],
    ["fri 12pm", "2026-10-23", "12:00"],
    ["fri noon", "2026-10-23", "12:00"],
    ["fri 3 pm", "2026-10-23", "15:00"],
    ["3pm", "2026-10-17", "15:00"],
    ["15:30", "2026-10-17", "15:30"],
    ["noon", "2026-10-17", "12:00"],
  ])("%s → %s at %s", (query, day, time) => {
    expect(parseDateQuery(query, TODAY)).toEqual({ day, time });
  });

  it("moves a time alone to tomorrow once it has passed", () => {
    expect(parseDateQuery("9am", TODAY, "10:00")).toEqual({
      day: "2026-10-18",
      time: "09:00",
    });
    expect(parseDateQuery("9am", TODAY, "08:00")).toEqual({
      day: "2026-10-17",
      time: "09:00",
    });
    expect(parseDateQuery("fri 9am", TODAY, "10:00")).toEqual({
      day: "2026-10-23",
      time: "09:00",
    });
  });

  it("clamps month arithmetic to the month's end", () => {
    expect(parseDateQuery("in 1 month", "2026-01-31")).toEqual({
      day: "2026-02-28",
    });
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
    "fri 25:00",
    "fri 13pm",
    "fri 0am",
    "fri 3:75pm",
    "foo 3pm",
  ])("rejects %j", (query) => {
    expect(parseDateQuery(query, TODAY)).toBeNull();
  });
});
