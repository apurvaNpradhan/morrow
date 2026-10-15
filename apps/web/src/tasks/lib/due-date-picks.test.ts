import { describe, expect, it } from "vite-plus/test";
import { quickDueDates } from "./due-date-picks";

const days = (today: string, weekStartsOn = 1) =>
  Object.fromEntries(
    quickDueDates(today, weekStartsOn).map(({ key, day }) => [key, day]),
  );

describe("quickDueDates", () => {
  it("offers today, tomorrow, the coming Saturday and next Monday", () => {
    // 2026-10-15 is a Thursday.
    expect(days("2026-10-15")).toEqual({
      today: "2026-10-15",
      tomorrow: "2026-10-16",
      weekend: "2026-10-17",
      nextWeek: "2026-10-19",
    });
  });

  it("counts a Saturday as the weekend and a Sunday as it too", () => {
    expect(days("2026-10-17").weekend).toBe("2026-10-17");
    expect(days("2026-10-18").weekend).toBe("2026-10-18");
  });

  it("starts next week on the locale's first day", () => {
    expect(days("2026-10-15", 0).nextWeek).toBe("2026-10-18");
    expect(days("2026-10-18", 0).nextWeek).toBe("2026-10-25");
    expect(days("2026-10-18", 1).nextWeek).toBe("2026-10-19");
  });

  it("rolls over month and daylight-saving boundaries", () => {
    expect(days("2026-10-31").tomorrow).toBe("2026-11-01");
    expect(days("2026-10-29", 1).nextWeek).toBe("2026-11-02");
  });
});
