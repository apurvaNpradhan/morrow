import { describe, expect, it } from "vite-plus/test";
import { projectColorStyle } from "../lib/column-style";

describe("projectColorStyle", () => {
  it("colours the text with a hex colour", () => {
    expect(projectColorStyle("#3b82f6")).toEqual({ color: "#3b82f6" });
  });

  it("returns nothing for no colour or a value that is not hex", () => {
    expect(projectColorStyle(null)).toBeUndefined();
    expect(projectColorStyle("blue")).toBeUndefined();
    expect(projectColorStyle("#3B82F6")).toBeUndefined();
  });
});
