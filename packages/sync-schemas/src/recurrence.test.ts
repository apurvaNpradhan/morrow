import { describe, expect, it } from "vite-plus/test";
import {
  buildRecurrence,
  describeRecurrence,
  describeRecurrenceText,
  nextOccurrence,
  parseRecurrence,
  rebaseRecurrence,
  recurrenceText,
  type Recurrence,
} from "./recurrence.js";
import { formatTaskDate, parseTaskDate, type TaskDate } from "./task-dates.js";

const date = (text: string) => parseTaskDate(text)!;
const text = (value: TaskDate | null) =>
  value && formatTaskDate(value.at, value.hasTime);

function rule(source: string, due: string) {
  const parsed = parseRecurrence(source, date(due));
  if (!parsed.ok) throw new Error(`refused: ${parsed.reason}`);
  return parsed.recurrence;
}

const day = (compact: string, ...rrule: string[]) =>
  `DTSTART;VALUE=DATE:${compact}\nRRULE:${rrule.join(";")}`;

describe("parseRecurrence", () => {
  it.each([
    ["daily", day("20261030", "FREQ=DAILY")],
    ["weekdays", day("20261030", "FREQ=WEEKLY", "BYDAY=MO,TU,WE,TH,FR")],
    ["every 2 weeks", day("20261030", "FREQ=WEEKLY", "INTERVAL=2", "BYDAY=FR")],
    ["monthly on a day", day("20261030", "FREQ=MONTHLY", "BYMONTHDAY=30")],
    [
      "monthly on the last day",
      day("20261030", "FREQ=MONTHLY", "BYMONTHDAY=-1"),
    ],
    [
      "monthly on the 2nd Tuesday",
      day("20261030", "FREQ=MONTHLY", "BYDAY=2TU"),
    ],
    [
      "monthly on the last Friday",
      day("20261030", "FREQ=MONTHLY", "BYDAY=-1FR"),
    ],
    ["yearly", day("20261030", "FREQ=YEARLY", "BYMONTH=10")],
    ["ending after 5", day("20261030", "FREQ=DAILY", "COUNT=5")],
    ["ending on a day", day("20261030", "FREQ=DAILY", "UNTIL=20261231")],
    [
      "ending on an instant",
      day("20261030", "FREQ=DAILY", "UNTIL=20261231T000000Z"),
    ],
  ])("accepts %s", (_name, source) => {
    expect(parseRecurrence(source, date("2026-10-30")).ok).toBe(true);
  });

  it("accepts a timed rule whose DTSTART is the due moment on its zone's clock", () => {
    // 15:00 in Kolkata is 09:30 UTC.
    const parsed = parseRecurrence(
      "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=WEEKLY;BYDAY=FR",
      date("2026-10-30T09:30:00Z"),
    );
    expect(parsed).toMatchObject({ ok: true });
  });

  it.each([
    ["no DTSTART", "RRULE:FREQ=DAILY", "SYNTAX"],
    ["no RRULE", "DTSTART;VALUE=DATE:20261030", "SYNTAX"],
    [
      "a floating DTSTART",
      "DTSTART:20261030T150000\nRRULE:FREQ=DAILY",
      "SYNTAX",
    ],
    [
      "a bad time zone",
      "DTSTART;TZID=Mars/Olympus:20261030T150000\nRRULE:FREQ=DAILY",
      "BAD_TIME_ZONE",
    ],
    ["BYHOUR", day("20261030", "FREQ=DAILY", "BYHOUR=9"), "UNSUPPORTED_PART"],
    [
      "BYSETPOS",
      day("20261030", "FREQ=MONTHLY", "BYDAY=MO,TU", "BYSETPOS=1"),
      "UNSUPPORTED_PART",
    ],
    ["WKST", day("20261030", "FREQ=WEEKLY", "WKST=SU"), "UNSUPPORTED_PART"],
    ["a repeated part", day("20261030", "FREQ=DAILY", "FREQ=DAILY"), "SYNTAX"],
    ["HOURLY", day("20261030", "FREQ=HOURLY"), "BAD_FREQUENCY"],
    ["INTERVAL 0", day("20261030", "FREQ=DAILY", "INTERVAL=0"), "BAD_INTERVAL"],
    [
      "INTERVAL 100",
      day("20261030", "FREQ=DAILY", "INTERVAL=100"),
      "BAD_INTERVAL",
    ],
    ["COUNT 0", day("20261030", "FREQ=DAILY", "COUNT=0"), "BAD_COUNT"],
    ["COUNT 1000", day("20261030", "FREQ=DAILY", "COUNT=1000"), "BAD_COUNT"],
    [
      "UNTIL with COUNT",
      day("20261030", "FREQ=DAILY", "UNTIL=20261231", "COUNT=3"),
      "UNTIL_AND_COUNT",
    ],
    [
      "a bad UNTIL",
      day("20261030", "FREQ=DAILY", "UNTIL=tomorrow"),
      "BAD_UNTIL",
    ],
    ["a bad BYDAY", day("20261030", "FREQ=WEEKLY", "BYDAY=XX"), "BAD_BYDAY"],
    [
      "an ordinal under WEEKLY",
      day("20261030", "FREQ=WEEKLY", "BYDAY=2TU"),
      "ORDINAL_NOT_MONTHLY",
    ],
    [
      "an ordinal under YEARLY",
      day("20261030", "FREQ=YEARLY", "BYDAY=1MO"),
      "ORDINAL_NOT_MONTHLY",
    ],
    [
      "BYMONTHDAY 32",
      day("20261030", "FREQ=MONTHLY", "BYMONTHDAY=32"),
      "BAD_BYMONTHDAY",
    ],
    ["BYMONTH 13", day("20261030", "FREQ=YEARLY", "BYMONTH=13"), "BAD_BYMONTH"],
    [
      "a DTSTART that is not the due date",
      day("20261031", "FREQ=DAILY"),
      "DTSTART_MISMATCH",
    ],
  ])("refuses %s", (_name, source, reason) => {
    expect(parseRecurrence(source, date("2026-10-30"))).toEqual({
      ok: false,
      reason,
    });
  });

  it("refuses a day rule on a moment, and a timed rule on a day", () => {
    expect(
      parseRecurrence(
        day("20261030", "FREQ=DAILY"),
        date("2026-10-30T09:30:00Z"),
      ),
    ).toEqual({ ok: false, reason: "DTSTART_MISMATCH" });
    expect(
      parseRecurrence(
        "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=DAILY",
        date("2026-10-30"),
      ),
    ).toEqual({ ok: false, reason: "DTSTART_MISMATCH" });
  });

  it("refuses a DTSTART that is another time of the due day", () => {
    expect(
      parseRecurrence(
        "DTSTART;TZID=Asia/Kolkata:20261030T160000\nRRULE:FREQ=DAILY",
        date("2026-10-30T09:30:00Z"),
      ),
    ).toEqual({ ok: false, reason: "DTSTART_MISMATCH" });
  });

  it("refuses text that is too long", () => {
    expect(
      parseRecurrence(
        day("20261030", `FREQ=DAILY;${"X".repeat(500)}`),
        date("2026-10-30"),
      ),
    ).toEqual({ ok: false, reason: "SYNTAX" });
  });
});

describe("recurrenceText", () => {
  it("round-trips through parseRecurrence", () => {
    const source = day(
      "20261030",
      "FREQ=MONTHLY",
      "INTERVAL=2",
      "BYDAY=2TU",
      "COUNT=6",
    );
    expect(recurrenceText(rule(source, "2026-10-30"))).toBe(
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=MONTHLY;INTERVAL=2;BYDAY=2TU;COUNT=6",
    );
  });

  it("writes a timed rule with its zone", () => {
    const built = buildRecurrence(
      { freq: "WEEKLY", byDay: [{ day: "MO" }] },
      date("2026-10-26T13:00:00Z"),
      "America/New_York",
    );
    expect(recurrenceText(built)).toBe(
      "DTSTART;TZID=America/New_York:20261026T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO",
    );
  });
});

describe("nextOccurrence", () => {
  const today = "2026-10-01";
  const next = (source: string, due: string, now = today) =>
    text(nextOccurrence(rule(source, due), date(due), now));

  it.each([
    ["daily", day("20261030", "FREQ=DAILY"), "2026-10-30", "2026-10-31"],
    [
      "every 3 days",
      day("20261030", "FREQ=DAILY", "INTERVAL=3"),
      "2026-10-30",
      "2026-11-02",
    ],
    [
      "weekly on its weekday",
      day("20261030", "FREQ=WEEKLY"),
      "2026-10-30",
      "2026-11-06",
    ],
    [
      "weekdays over a weekend",
      day("20261030", "FREQ=WEEKLY", "BYDAY=MO,TU,WE,TH,FR"),
      "2026-10-30",
      "2026-11-02",
    ],
    [
      "weekly on chosen days",
      day("20261026", "FREQ=WEEKLY", "BYDAY=MO,TH"),
      "2026-10-26",
      "2026-10-29",
    ],
    [
      "every 2 weeks",
      day("20261030", "FREQ=WEEKLY", "INTERVAL=2"),
      "2026-10-30",
      "2026-11-13",
    ],
    [
      "monthly on day 30",
      day("20261030", "FREQ=MONTHLY", "BYMONTHDAY=30"),
      "2026-10-30",
      "2026-11-30",
    ],
    [
      "monthly on day 31 skips short months",
      day("20261031", "FREQ=MONTHLY", "BYMONTHDAY=31"),
      "2026-10-31",
      "2026-12-31",
    ],
    [
      "monthly on the last day",
      day("20261031", "FREQ=MONTHLY", "BYMONTHDAY=-1"),
      "2026-10-31",
      "2026-11-30",
    ],
    [
      "monthly on the 2nd Tuesday",
      day("20261013", "FREQ=MONTHLY", "BYDAY=2TU"),
      "2026-10-13",
      "2026-11-10",
    ],
    ["yearly", day("20261030", "FREQ=YEARLY"), "2026-10-30", "2027-10-30"],
    [
      "yearly on Feb 29",
      day("20280229", "FREQ=YEARLY"),
      "2028-02-29",
      "2032-02-29",
    ],
  ])("%s", (_name, source, due, expected) => {
    expect(next(source, due)).toBe(expected);
  });

  it("skips occurrences already past when a task is finished late", () => {
    const source = day("20261001", "FREQ=DAILY");
    expect(next(source, "2026-10-01", "2026-10-10")).toBe("2026-10-10");
    const weekly = day("20261001", "FREQ=WEEKLY");
    expect(next(weekly, "2026-10-01", "2026-10-20")).toBe("2026-10-22");
  });

  it("ends when COUNT is used up or UNTIL has passed", () => {
    const counted = rule(
      day("20261030", "FREQ=DAILY", "COUNT=2"),
      "2026-10-30",
    );
    expect(text(nextOccurrence(counted, date("2026-10-30"), today))).toBe(
      "2026-10-31",
    );
    expect(nextOccurrence(counted, date("2026-10-31"), today)).toBeNull();

    const until = rule(
      day("20261030", "FREQ=DAILY", "UNTIL=20261101"),
      "2026-10-30",
    );
    expect(text(nextOccurrence(until, date("2026-10-31"), today))).toBe(
      "2026-11-01",
    );
    expect(nextOccurrence(until, date("2026-11-01"), today)).toBeNull();
  });

  it("ends when skipping to today passes the end of the series", () => {
    const until = rule(
      day("20261001", "FREQ=DAILY", "UNTIL=20261005"),
      "2026-10-01",
    );
    expect(nextOccurrence(until, date("2026-10-01"), "2026-10-20")).toBeNull();
  });

  it("keeps a timed rule's wall-clock time across a daylight-saving change", () => {
    // New York leaves summer time on 2026-11-01: 09:00 is 13:00 UTC before, 14:00 UTC after.
    const source =
      "DTSTART;TZID=America/New_York:20261026T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO";
    const due = "2026-10-26T13:00:00Z";
    expect(next(source, due)).toBe("2026-11-02T14:00:00.000Z");
    expect(next(source, "2026-10-26T13:00:00Z", "2026-11-03")).toBe(
      "2026-11-09T14:00:00.000Z",
    );
  });

  it("keeps the wall-clock time in the other direction, into summer time", () => {
    const source =
      "DTSTART;TZID=America/New_York:20260302T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO";
    // 09:00 EST is 14:00 UTC; after 2026-03-08 it is 13:00 UTC.
    expect(next(source, "2026-03-02T14:00:00Z", "2026-03-01")).toBe(
      "2026-03-09T13:00:00.000Z",
    );
  });

  it("answers the same whatever zone the machine is in", () => {
    // The arithmetic is floating UTC; this guards against a local-time leak.
    const due = "2026-10-30T09:30:00Z";
    const source =
      "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=30";
    expect(next(source, due)).toBe("2026-11-30T09:30:00.000Z");
  });
});

describe("rebaseRecurrence", () => {
  it("moves DTSTART to the new due date and the series with it", () => {
    const moved = rebaseRecurrence(
      rule(day("20261030", "FREQ=WEEKLY"), "2026-10-30"),
      date("2026-11-04"),
      "UTC",
    );
    expect(recurrenceText(moved)).toBe(
      "DTSTART;VALUE=DATE:20261104\nRRULE:FREQ=WEEKLY",
    );
    expect(text(nextOccurrence(moved, date("2026-11-04"), "2026-11-01"))).toBe(
      "2026-11-11",
    );
  });

  it("lowers COUNT by the occurrences it passed over", () => {
    const daily = rule(day("20261030", "FREQ=DAILY", "COUNT=5"), "2026-10-30");
    const moved = rebaseRecurrence(daily, date("2026-11-01"), "UTC");
    expect(recurrenceText(moved)).toContain("COUNT=3");
  });

  it("leaves COUNT alone when the date moves earlier, and keeps at least one", () => {
    const daily = rule(day("20261030", "FREQ=DAILY", "COUNT=5"), "2026-10-30");
    expect(
      recurrenceText(rebaseRecurrence(daily, date("2026-10-28"), "UTC")),
    ).toContain("COUNT=5");
    expect(
      recurrenceText(rebaseRecurrence(daily, date("2027-01-01"), "UTC")),
    ).toContain("COUNT=1");
  });

  it("switches between a day and a moment", () => {
    const onDays = rule(day("20261030", "FREQ=WEEKLY"), "2026-10-30");
    const timed = rebaseRecurrence(
      onDays,
      date("2026-10-30T09:30:00Z"),
      "Asia/Kolkata",
    );
    expect(recurrenceText(timed)).toBe(
      "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=WEEKLY",
    );
    const back = rebaseRecurrence(timed, date("2026-10-30"), "Asia/Kolkata");
    expect(recurrenceText(back)).toBe(
      "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY",
    );
  });

  it("keeps a timed rule's own zone, not the editor's", () => {
    const timed: Recurrence = rule(
      "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=WEEKLY",
      "2026-10-30T09:30:00Z",
    );
    const moved = rebaseRecurrence(
      timed,
      date("2026-11-06T10:30:00Z"),
      "America/New_York",
    );
    expect(recurrenceText(moved)).toContain(
      "TZID=Asia/Kolkata:20261106T160000",
    );
  });
});

describe("describeRecurrenceText", () => {
  it("reads a stored rule without its task", () => {
    expect(
      describeRecurrenceText(day("20261026", "FREQ=WEEKLY", "BYDAY=MO")),
    ).toBe("every week on Monday");
    expect(
      describeRecurrenceText(
        "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=DAILY",
      ),
    ).toBe("every day");
    expect(describeRecurrenceText("nonsense")).toBeNull();
  });
});

describe("describeRecurrence", () => {
  it("reads in words", () => {
    expect(
      describeRecurrence(
        rule(day("20261026", "FREQ=WEEKLY", "BYDAY=MO"), "2026-10-26"),
      ),
    ).toBe("every week on Monday");
    expect(
      describeRecurrence(
        rule(day("20261013", "FREQ=MONTHLY", "BYDAY=2TU"), "2026-10-13"),
      ),
    ).toBe("every month on the 2nd Tuesday");
  });
});
