import { describe, expect, it } from "vite-plus/test";
import { filterProjectIcons } from "./filter-project-icons";

describe("filterProjectIcons", () => {
  it("returns every icon for an empty query", () => {
    expect(filterProjectIcons("  ").length).toBeGreaterThan(250);
  });

  it("matches case-insensitively on part of the name", () => {
    expect(filterProjectIcons("ROCK")).toContain("Rocket");
  });

  it("ignores spaces and dashes in the query", () => {
    expect(filterProjectIcons("graduation cap")).toEqual(["GraduationCap"]);
    expect(filterProjectIcons("shopping-cart")).toEqual(["ShoppingCart"]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterProjectIcons("zzzz")).toEqual([]);
  });
});
