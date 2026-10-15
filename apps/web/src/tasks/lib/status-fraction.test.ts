import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { statusFractions } from "./status-fraction";

const column = (id: string, category: ProjectColumnRow["category"]) =>
  ({ id, category }) as ProjectColumnRow;

describe("statusFractions", () => {
  it("fills a lone started Column halfway", () => {
    const fractions = statusFractions([
      column("a", "unstarted"),
      column("b", "started"),
    ]);
    expect(fractions.get("b")).toBe(0.5);
    expect(fractions.has("a")).toBe(false);
  });

  it("spreads several started Columns in board order", () => {
    const fractions = statusFractions([
      column("a", "started"),
      column("b", "done"),
      column("c", "started"),
    ]);
    expect(fractions.get("a")).toBeCloseTo(1 / 3);
    expect(fractions.get("c")).toBeCloseTo(2 / 3);
  });
});
