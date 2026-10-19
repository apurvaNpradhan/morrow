import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { completion } from "./completion";

const column = (id: string, category: string) =>
  ({ id, category, color: "#000000" }) as ProjectColumnRow;
const columns = [
  column("todo", "unstarted"),
  column("done", "done"),
  column("no", "canceled"),
];

describe("completion", () => {
  it("is done over everything that is not canceled", () => {
    const result = completion(columns, [
      { columnId: "todo", count: 1 },
      { columnId: "done", count: 1 },
      { columnId: "no", count: 6 },
    ]);
    expect(result.percent).toBe(50);
    expect(result.total).toBe(8);
  });

  it("starts each segment after the ones before it, in board order", () => {
    const result = completion(columns, [
      { columnId: "no", count: 2 },
      { columnId: "todo", count: 3 },
    ]);
    expect(
      result.segments.map(({ column, before }) => [column.id, before]),
    ).toEqual([
      ["todo", 0],
      ["no", 3],
    ]);
  });

  it("drops empty columns and is 0 with no tasks", () => {
    const result = completion(columns, []);
    expect(result.segments).toEqual([]);
    expect(result.percent).toBe(0);
  });
});
