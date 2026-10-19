import { describe, expect, it, vi } from "vite-plus/test";
import { keepTextUnselectedOnShiftClick } from "./select-gesture";

describe("keepTextUnselectedOnShiftClick", () => {
  it("cancels the browser's text selection on a shift mousedown", () => {
    const preventDefault = vi.fn();

    keepTextUnselectedOnShiftClick({ shiftKey: true, preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("leaves a plain mousedown alone", () => {
    const preventDefault = vi.fn();

    keepTextUnselectedOnShiftClick({ shiftKey: false, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
