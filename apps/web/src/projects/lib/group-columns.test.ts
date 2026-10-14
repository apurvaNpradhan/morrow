import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { groupColumns } from "./group-columns";

const column = (
  id: string,
  category: ProjectColumnRow["category"],
  position: string,
): ProjectColumnRow => ({
  id,
  projectId: "p",
  name: id,
  category,
  color: "gray",
  position,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe("groupColumns", () => {
  it("lists every category in workflow order, empty ones too", () => {
    const groups = groupColumns([column("todo", "unstarted", "a0")]);

    expect(groups.map((group) => group.category)).toEqual([
      "backlog",
      "unstarted",
      "started",
      "done",
      "canceled",
    ]);
    expect(groups.map((group) => group.columns.length)).toEqual([
      0, 1, 0, 0, 0,
    ]);
  });

  it("orders columns inside a category by byte order of their position", () => {
    const groups = groupColumns([
      column("late", "started", "a1"),
      column("early", "started", "Zz"),
      column("middle", "started", "a0"),
    ]);

    expect(groups[2]?.columns.map((entry) => entry.id)).toEqual([
      "early",
      "middle",
      "late",
    ]);
  });
});
