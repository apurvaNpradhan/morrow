import { describe, expect, it } from "vite-plus/test";
import { nextDueDate, recurrenceSummary } from "./recurrence-summary";

const task = (
  recurrence: string | null,
  due: string | null = "2026-10-30",
) => ({
  recurrence,
  dueAt: due ? new Date(`${due}T00:00:00Z`) : null,
  dueHasTime: false,
});
const weekly = "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;BYDAY=FR";

describe("recurrenceSummary", () => {
  it("describes the rule in words", () => {
    expect(recurrenceSummary(task(weekly))).toBe("every week on Friday");
  });

  it("is null without a rule, without a due date, or when the rule does not fit the date", () => {
    expect(recurrenceSummary(task(null))).toBeNull();
    expect(recurrenceSummary(task(weekly, null))).toBeNull();
    expect(recurrenceSummary(task(weekly, "2026-10-31"))).toBeNull();
  });
});

describe("nextDueDate", () => {
  it("is the date the next occurrence would have", () => {
    const next = nextDueDate(task(weekly), "2026-10-26");
    expect(next?.at.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("skips what is already past when today is later", () => {
    const next = nextDueDate(task(weekly), "2026-11-20");
    expect(next?.at.toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });

  it("is null for a series that has ended", () => {
    const ended = "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=DAILY;COUNT=1";
    expect(nextDueDate(task(ended), "2026-10-26")).toBeNull();
  });
});
