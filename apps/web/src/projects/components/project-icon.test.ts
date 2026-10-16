import { describe, expect, it } from "vite-plus/test";
import { projectColorClass } from "./project-icon";

describe("projectColorClass", () => {
  it("maps a colour token to its text class", () => {
    expect(projectColorClass("blue")).toContain("text-blue-");
  });

  it("returns nothing for no colour or an unknown one", () => {
    expect(projectColorClass(null)).toBeUndefined();
    expect(projectColorClass("chartreuse")).toBeUndefined();
  });
});
