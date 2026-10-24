import { describe, expect, it } from "vite-plus/test";
import { matchColumn } from "./match-column.js";

const columns = [
  { id: "a", name: "Backlog", category: "backlog" as const },
  { id: "b", name: "To Do", category: "unstarted" as const },
  { id: "c", name: "Doing", category: "started" as const },
  { id: "d", name: "In Review", category: "started" as const },
  { id: "e", name: "Done", category: "done" as const },
];

describe("matchColumn", () => {
  it("prefers the column with the same name", () => {
    expect(
      matchColumn(columns, { column: "In Review", category: "done" }, []),
    ).toEqual({ column: columns[3], exact: true });
  });

  it("falls back to the first column of the task's category", () => {
    expect(
      matchColumn(columns, { column: "Shipped", category: "done" }, []),
    ).toEqual({ column: columns[4], exact: false });
  });

  it("reads the category from the file's column list when the task has none", () => {
    expect(
      matchColumn(columns, { column: "QA" }, [
        { name: "QA", category: "started" },
      ]),
    ).toEqual({ column: columns[2], exact: false });
  });

  it("ends at the first unstarted column", () => {
    expect(matchColumn(columns, { column: "???" }, [])).toEqual({
      column: columns[1],
      exact: false,
    });
    expect(
      matchColumn(columns, { column: "Gone", category: "canceled" }, []),
    ).toEqual({ column: columns[1], exact: false });
  });
});
