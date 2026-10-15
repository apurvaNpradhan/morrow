import { checklistCounts } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";

describe("checklistCounts", () => {
  it("counts task-list items, checked or not", () => {
    expect(
      checklistCounts("Plan\n\n- [x] one\n- [ ] two\n* [X] three\n- [ ] four"),
    ).toEqual({ done: 2, total: 4 });
  });

  it("counts nested and numbered items", () => {
    expect(checklistCounts("1. [x] a\n   - [ ] b")).toEqual({
      done: 1,
      total: 2,
    });
  });

  it("is zero without a checklist, ignoring brackets in prose", () => {
    expect(checklistCounts("")).toEqual({ done: 0, total: 0 });
    expect(checklistCounts("just [x] words\n- plain bullet")).toEqual({
      done: 0,
      total: 0,
    });
  });
});
