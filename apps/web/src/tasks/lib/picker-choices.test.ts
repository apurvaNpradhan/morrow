import { describe, expect, it } from "vite-plus/test";
import { parentChoices, relationChoices } from "./picker-choices";

const row = (id: string, parentId: string | null = null, projectId = "p1") => ({
  id,
  parentId,
  projectId,
});

describe("parentChoices", () => {
  // a > b > c, and d, e beside them; f is in another Project.
  const known = [
    row("a"),
    row("b", "a"),
    row("c", "b"),
    row("d"),
    row("e", "d"),
    row("f", null, "p2"),
  ];

  it("leaves out the task itself and everything under it, at any depth", () => {
    const choices = parentChoices(known, row("a"), known).map((r) => r.id);
    expect(choices).toEqual(["d", "e"]);
  });

  it("leaves out a task of another Project", () => {
    const choices = parentChoices(known, row("d"), known).map((r) => r.id);
    expect(choices).not.toContain("f");
  });

  it("offers a leaf's own ancestors and siblings", () => {
    const choices = parentChoices(known, row("c", "b"), known).map((r) => r.id);
    expect(choices).toEqual(["a", "b", "d", "e"]);
  });
});

describe("relationChoices", () => {
  const candidates = [row("a"), row("b"), row("c"), row("d")];
  const relations = [
    { type: "blocks" as const, sourceTaskId: "a", targetTaskId: "b" },
    { type: "related" as const, sourceTaskId: "a", targetTaskId: "c" },
  ];

  it("leaves out the task itself and tasks already linked with that type, either way round", () => {
    expect(
      relationChoices(candidates, { id: "a" }, relations, "blocks").map(
        (r) => r.id,
      ),
    ).toEqual(["c", "d"]);
    expect(
      relationChoices(candidates, { id: "b" }, relations, "blocks").map(
        (r) => r.id,
      ),
    ).toEqual(["c", "d"]);
  });

  it("keeps a task linked with another type", () => {
    expect(
      relationChoices(candidates, { id: "a" }, relations, "duplicate").map(
        (r) => r.id,
      ),
    ).toEqual(["b", "c", "d"]);
  });
});
