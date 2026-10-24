import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useToday } from "./use-today";

const zone = vi.hoisted(() => ({ current: "UTC" }));
vi.mock("@/app/hooks/use-time-zone", () => ({
  useTimeZone: () => zone.current,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useToday", () => {
  it("advances at midnight in the user's zone", () => {
    vi.useFakeTimers();
    zone.current = "Asia/Kolkata";
    // 18:29 UTC is 23:59 in Kolkata.
    vi.setSystemTime(new Date("2030-01-01T18:29:00Z"));
    const { result } = renderHook(useToday);
    expect(result.current).toBe("2030-01-01");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe("2030-01-02");
  });

  it("catches up when a suspended tab regains focus and clears its timer", () => {
    vi.useFakeTimers();
    zone.current = "UTC";
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    const { result, unmount } = renderHook(useToday);
    vi.setSystemTime(new Date("2030-01-04T12:00:00Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("2030-01-04");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
