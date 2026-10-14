import { describe, expect, it } from "vite-plus/test";
import { BACKGROUND_MAX_WIDTH, fitWidth } from "./prepare-background-image";

describe("fitWidth", () => {
  it("leaves a picture that is narrow enough as it is", () => {
    expect(fitWidth(800, 600, BACKGROUND_MAX_WIDTH)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("scales a wide picture down, keeping its shape", () => {
    expect(fitWidth(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("never rounds the height down to nothing", () => {
    expect(fitWidth(100_000, 1, 1600).height).toBe(1);
  });
});
