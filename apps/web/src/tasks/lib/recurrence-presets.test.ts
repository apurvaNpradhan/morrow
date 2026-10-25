import { parseRecurrence } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import {
  dayFacts,
  presetOptions,
  RECURRENCE_PRESETS,
  ruleText,
} from "./recurrence-presets";

const day = (text: string) => ({
  at: new Date(`${text}T00:00:00Z`),
  hasTime: false,
});

describe("dayFacts", () => {
  it("names a day's weekday and its place in the month", () => {
    // Friday the 30th is the last Friday of October 2026; the 9th is the 2nd Monday... of November.
    expect(dayFacts(day("2026-10-30"), "UTC")).toMatchObject({
      weekday: "FR",
      date: 30,
      month: 10,
      nth: -1,
    });
    expect(dayFacts(day("2026-11-09"), "UTC")).toMatchObject({
      weekday: "MO",
      nth: 2,
    });
    expect(dayFacts(day("2026-11-01"), "UTC")).toMatchObject({
      weekday: "SU",
      nth: 1,
    });
  });

  it("reads a moment's day in the user's zone", () => {
    const moment = { at: new Date("2026-10-30T22:00:00Z"), hasTime: true };
    expect(dayFacts(moment, "UTC").date).toBe(30);
    expect(dayFacts(moment, "Asia/Kolkata").date).toBe(31);
  });
});

describe("ruleText", () => {
  const due = day("2026-10-30");

  it.each([
    ["daily", "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=DAILY"],
    [
      "weekdays",
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    ],
    ["weekly", "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;BYDAY=FR"],
    [
      "monthlyDay",
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=MONTHLY;BYMONTHDAY=30",
    ],
    [
      "monthlyNth",
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=MONTHLY;BYDAY=-1FR",
    ],
    [
      "yearly",
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=YEARLY;BYMONTHDAY=30;BYMONTH=10",
    ],
  ] as const)("writes the %s preset", (preset, expected) => {
    expect(ruleText(presetOptions(preset, due, "UTC"), due, "UTC")).toBe(
      expected,
    );
  });

  it("writes only rules the server accepts, for a day and for a moment", () => {
    const moment = { at: new Date("2026-10-30T09:30:00Z"), hasTime: true };
    for (const date of [due, moment]) {
      for (const preset of RECURRENCE_PRESETS) {
        const text = ruleText(
          presetOptions(preset, date, "Asia/Kolkata"),
          date,
          "Asia/Kolkata",
        );
        expect(parseRecurrence(text, date)).toMatchObject({ ok: true });
      }
    }
  });
});
