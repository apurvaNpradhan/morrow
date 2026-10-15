import {
  isCalendarDate,
  nextCompletedAt,
  parseTicketId,
  ticketId,
} from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";

describe("nextCompletedAt", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  const before = new Date("2026-10-01T10:00:00Z");

  it("stamps entering a done or canceled column", () => {
    expect(nextCompletedAt(null, "started", "done", now)).toEqual(now);
    expect(nextCompletedAt(null, "unstarted", "canceled", now)).toEqual(now);
  });

  it("keeps the stamp between two closed columns", () => {
    expect(nextCompletedAt(before, "done", "canceled", now)).toEqual(before);
    expect(nextCompletedAt(before, "done", "done", now)).toEqual(before);
  });

  it("clears the stamp on leaving", () => {
    expect(nextCompletedAt(before, "done", "started", now)).toBeNull();
    expect(nextCompletedAt(null, "backlog", "started", now)).toBeNull();
  });
});

describe("ticket ids", () => {
  it("builds and parses them", () => {
    expect(ticketId("MOR", 12)).toBe("MOR-12");
    expect(parseTicketId("MOR-12")).toEqual({ key: "MOR", number: 12 });
    expect(parseTicketId(" mor-7 ")).toEqual({ key: "MOR", number: 7 });
  });

  it("rejects what is not one", () => {
    for (const value of [
      "MOR",
      "MOR-0",
      "MOR-",
      "1-2",
      "MOR-12x",
      "M-1",
      "TOOLONGKEY-1",
    ]) {
      expect(parseTicketId(value)).toBeNull();
    }
  });
});

describe("isCalendarDate", () => {
  it("accepts real days only", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-10-15T00:00:00Z")).toBe(false);
  });
});
