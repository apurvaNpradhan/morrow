import type { DocumentRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import {
  ancestorIds,
  indexPages,
  isInSubtree,
  moveTarget,
  positionAtEnd,
  visibleRows,
} from "./document-tree";

const NOW = new Date("2026-10-26T00:00:00Z");

function page(
  id: string,
  position: string,
  rest: Partial<DocumentRow> = {},
): DocumentRow {
  return {
    id,
    workspaceId: "w",
    projectId: null,
    parentId: null,
    position,
    title: id,
    icon: null,
    generation: 1,
    overLimit: false,
    archivedAt: null,
    archivedRootId: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...rest,
  };
}

const ROOT = { projectId: null };
const ids = (rows: { document: DocumentRow }[]) =>
  rows.map((row) => row.document.id);

describe("visibleRows", () => {
  const pages = [
    page("b", "a1"),
    page("a", "a0"),
    page("a2", "a1", { parentId: "a" }),
    page("a1", "a0", { parentId: "a" }),
    page("a1x", "a0", { parentId: "a1" }),
    page("p", "a0", { projectId: "P" }),
  ];

  it("orders siblings by position and shows only expanded children", () => {
    const index = indexPages(pages);

    expect(ids(visibleRows(index, ROOT, new Set()))).toEqual(["a", "b"]);
    expect(ids(visibleRows(index, ROOT, new Set(["a"])))).toEqual([
      "a",
      "a1",
      "a2",
      "b",
    ]);
    const deep = visibleRows(index, ROOT, new Set(["a", "a1"]));
    expect(deep.map((row) => [row.document.id, row.depth])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a1x", 2],
      ["a2", 1],
      ["b", 0],
    ]);
  });

  it("marks pages with children and whether they are open", () => {
    const rows = visibleRows(indexPages(pages), ROOT, new Set(["a"]));

    expect(rows.find((row) => row.document.id === "a")).toMatchObject({
      hasChildren: true,
      expanded: true,
    });
    expect(rows.find((row) => row.document.id === "b")).toMatchObject({
      hasChildren: false,
      expanded: false,
    });
  });

  it("keeps a Project's pages apart from the root's", () => {
    const index = indexPages(pages);

    expect(ids(visibleRows(index, { projectId: "P" }, new Set()))).toEqual([
      "p",
    ]);
    expect(ids(visibleRows(index, ROOT, new Set()))).not.toContain("p");
  });

  it("hides an archived page and everything under it", () => {
    const index = indexPages(
      pages.map((row) =>
        row.id === "a" ? { ...row, archivedAt: NOW, archivedRootId: "a" } : row,
      ),
    );

    expect(ids(visibleRows(index, ROOT, new Set(["a", "a1"])))).toEqual(["b"]);
    expect(index.hidden.has("a1x")).toBe(true);
  });
});

describe("ancestors and subtrees", () => {
  const index = indexPages([
    page("a", "a0"),
    page("b", "a0", { parentId: "a" }),
    page("c", "a0", { parentId: "b" }),
  ]);

  it("lists the pages above one, top first", () => {
    expect(ancestorIds(index, "c")).toEqual(["a", "b"]);
    expect(ancestorIds(index, "a")).toEqual([]);
  });

  it("says whether a page is in another's subtree", () => {
    expect(isInSubtree(index, "a", "c")).toBe(true);
    expect(isInSubtree(index, "b", "b")).toBe(true);
    expect(isInSubtree(index, "c", "a")).toBe(false);
  });
});

describe("moveTarget", () => {
  const pages = [
    page("a", "a0"),
    page("b", "a1"),
    page("c", "a2"),
    page("a-child", "a0", { parentId: "a" }),
  ];
  const index = indexPages(pages);
  const get = (id: string) => pages.find((row) => row.id === id)!;

  it("puts a page before or after another among its siblings", () => {
    const before = moveTarget(index, get("c"), get("b"), "before", ROOT);
    const after = moveTarget(index, get("a"), get("b"), "after", ROOT);

    expect(before).toMatchObject({ parentId: null, projectId: null });
    expect(before!.position > "a0" && before!.position < "a1").toBe(true);
    expect(after!.position > "a1" && after!.position < "a2").toBe(true);
  });

  it("puts a page inside another, after its last child", () => {
    const target = moveTarget(index, get("c"), get("a"), "inside", ROOT);

    expect(target).toMatchObject({ parentId: "a", projectId: null });
    expect(target!.position > "a0").toBe(true);
  });

  it("takes the target's project", () => {
    const withProject = [...pages, page("p1", "a0", { projectId: "P" })];
    const next = indexPages(withProject);

    const target = moveTarget(
      next,
      withProject[0]!,
      withProject.at(-1)!,
      "before",
      { projectId: "P" },
    );

    expect(target).toMatchObject({ parentId: null, projectId: "P" });
  });

  it("refuses a drop onto the page itself or its own subtree", () => {
    expect(moveTarget(index, get("a"), get("a"), "inside", ROOT)).toBeNull();
    expect(
      moveTarget(index, get("a"), get("a-child"), "before", ROOT),
    ).toBeNull();
  });

  it("reports nothing to do when the page would stay where it is", () => {
    expect(moveTarget(index, get("a"), get("b"), "before", ROOT)).toBeNull();
  });
});

describe("positionAtEnd", () => {
  it("is after the last page of a level", () => {
    const index = indexPages([page("a", "a0"), page("b", "a5")]);

    expect(positionAtEnd(index, null, ROOT) > "a5").toBe(true);
    expect(positionAtEnd(indexPages([]), null, ROOT)).toBe("a0");
  });
});
