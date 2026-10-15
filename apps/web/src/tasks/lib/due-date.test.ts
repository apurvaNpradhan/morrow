import { describe, expect, it } from "vite-plus/test";
import { dueLabel, isOverdue } from "./due-date";

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
  it("is true only for an unfinished task due before today", () => {
    const open = { completedAt: null };
    expect(isOverdue({ ...open, dueDate: "2026-10-14" }, "2026-10-15")).toBe(
      true,
    );
    expect(isOverdue({ ...open, dueDate: "2026-10-15" }, "2026-10-15")).toBe(
      false,
    );
    expect(isOverdue({ ...open, dueDate: null }, "2026-10-15")).toBe(false);
    expect(
      isOverdue(
        { completedAt: new Date(), dueDate: "2026-10-01" },
        "2026-10-15",
      ),
    ).toBe(false);
  });
});
