import { describe, expect, it } from "vite-plus/test";
import {
  formatTaskDate,
  isTimeZone,
  momentInZone,
  parseTaskDate,
  taskDateDay,
  timeInZone,
} from "./task-dates.js";

describe("parseTaskDate", () => {
  it("reads a day as 00:00 UTC without a time", () => {
    expect(parseTaskDate("2026-10-24")).toEqual({
      at: new Date("2026-10-24T00:00:00Z"),
      hasTime: false,
    });
  });

  it("reads a moment with an offset as its UTC instant", () => {
    expect(parseTaskDate("2026-10-24T15:00:00+05:30")).toEqual({
      at: new Date("2026-10-24T09:30:00Z"),
      hasTime: true,
    });
    expect(parseTaskDate("2026-10-24T09:30Z")?.at).toEqual(
      new Date("2026-10-24T09:30:00Z"),
    );
  });

  it.each([
    "2026-02-30",
    "2026-10-24T15:00:00",
    "24/10/2026",
    "friday",
    "2026-13-01T00:00:00Z",
    "",
  ])("refuses %j", (text) => {
    expect(parseTaskDate(text)).toBeNull();
  });
});

describe("formatTaskDate", () => {
  it("writes a day as YYYY-MM-DD and a moment as ISO UTC", () => {
    expect(formatTaskDate(new Date("2026-10-24T00:00:00Z"), false)).toBe(
      "2026-10-24",
    );
    expect(formatTaskDate(new Date("2026-10-24T09:30:00Z"), true)).toBe(
      "2026-10-24T09:30:00.000Z",
    );
    expect(formatTaskDate(null, false)).toBeNull();
  });
});

describe("taskDateDay", () => {
  it("keeps a day the same day in every zone", () => {
    const friday = new Date("2026-10-23T00:00:00Z");
    expect(taskDateDay(friday, false, "America/Los_Angeles")).toBe(
      "2026-10-23",
    );
    expect(taskDateDay(friday, false, "Pacific/Kiritimati")).toBe("2026-10-23");
  });

  it("puts a moment on the day it falls on in the zone", () => {
    const moment = new Date("2026-10-23T22:00:00Z");
    expect(taskDateDay(moment, true, "America/Los_Angeles")).toBe("2026-10-23");
    expect(taskDateDay(moment, true, "Asia/Kolkata")).toBe("2026-10-24");
  });
});

describe("isTimeZone", () => {
  it("accepts IANA names and refuses the rest", () => {
    expect(isTimeZone("Asia/Kolkata")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("+05:30")).toBe(false);
  });
});

describe("momentInZone", () => {
  it("reads a wall-clock time in a zone as its instant", () => {
    expect(momentInZone("2026-10-24", "15:00", "Asia/Kolkata")).toEqual(
      new Date("2026-10-24T09:30:00Z"),
    );
    expect(momentInZone("2026-10-24", "00:15", "UTC")).toEqual(
      new Date("2026-10-24T00:15:00Z"),
    );
  });

  it("follows daylight saving on both sides of the change", () => {
    // New York leaves summer time on 2026-11-01.
    expect(momentInZone("2026-10-31", "09:00", "America/New_York")).toEqual(
      new Date("2026-10-31T13:00:00Z"),
    );
    expect(momentInZone("2026-11-02", "09:00", "America/New_York")).toEqual(
      new Date("2026-11-02T14:00:00Z"),
    );
  });
});

describe("timeInZone", () => {
  it("is the wall-clock time of an instant in a zone", () => {
    expect(timeInZone(new Date("2026-10-24T09:30:00Z"), "Asia/Kolkata")).toBe(
      "15:00",
    );
  });
});
