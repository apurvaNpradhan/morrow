import { describe, expect, it } from "vite-plus/test";
import { dueLabel, isOverdue } from "./due-date";

const UTC = "UTC";

describe("dueLabel", () => {
  const today = "2026-10-15";

  it("counts overdue days, then weeks", () => {
    expect(dueLabel("2026-10-12", today)).toEqual({
      kind: "overdueDays",
      count: 3,
    });
    expect(dueLabel("2026-10-02", today)).toEqual({
      kind: "overdueDays",
      count: 13,
    });
    expect(dueLabel("2026-10-01", today)).toEqual({
      kind: "overdueWeeks",
      count: 2,
    });
    expect(dueLabel("2026-09-24", today)).toEqual({
      kind: "overdueWeeks",
      count: 3,
    });
  });

  it("names today and tomorrow, then counts days within a week, then shows the date", () => {
    expect(dueLabel("2026-10-15", today)).toEqual({ kind: "today" });
    expect(dueLabel("2026-10-16", today)).toEqual({ kind: "tomorrow" });
    expect(dueLabel("2026-10-19", today)).toEqual({ kind: "inDays", count: 4 });
    expect(dueLabel("2026-10-22", today)).toEqual({
      kind: "date",
      day: "2026-10-22",
    });
  });

  it("counts calendar days across a daylight-saving change", () => {
    expect(dueLabel("2026-11-02", "2026-10-30")).toEqual({
      kind: "inDays",
      count: 3,
    });
    expect(dueLabel("2026-03-10", "2026-03-08")).toEqual({
      kind: "inDays",
      count: 2,
    });
  });
});

describe("isOverdue", () => {
  const open = { completedAt: null };
  const day = (text: string) => ({
    dueAt: new Date(`${text}T00:00:00Z`),
    dueHasTime: false,
  });
  const none = { dueAt: null, dueHasTime: false };

  it("is true only for an unfinished day due before today", () => {
    expect(
      isOverdue({ ...open, ...day("2026-10-14") }, "2026-10-15", UTC),
    ).toBe(true);
    expect(
      isOverdue({ ...open, ...day("2026-10-15") }, "2026-10-15", UTC),
    ).toBe(false);
    expect(isOverdue({ ...open, ...none }, "2026-10-15", UTC)).toBe(false);
    expect(
      isOverdue(
        { completedAt: new Date(), ...day("2026-10-01") },
        "2026-10-15",
        UTC,
      ),
    ).toBe(false);
  });

  it("reads a day the same in every zone", () => {
    expect(
      isOverdue(
        { ...open, ...day("2026-10-15") },
        "2026-10-15",
        "Pacific/Kiritimati",
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { ...open, ...day("2026-10-14") },
        "2026-10-15",
        "Pacific/Pago_Pago",
      ),
    ).toBe(true);
  });

  it("is overdue once a moment has passed, not at the end of its day", () => {
    const moment = {
      dueAt: new Date("2026-10-15T09:00:00Z"),
      dueHasTime: true,
    };
    const task = { ...open, ...moment };
    expect(
      isOverdue(task, "2026-10-15", UTC, new Date("2026-10-15T08:59:00Z")),
    ).toBe(false);
    expect(
      isOverdue(task, "2026-10-15", UTC, new Date("2026-10-15T09:01:00Z")),
    ).toBe(true);
  });
});
