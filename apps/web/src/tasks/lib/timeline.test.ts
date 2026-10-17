import type { TaskCommentRow, TaskEventRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { buildTimeline, parseEvents } from "./timeline";

const at = (second: number) => new Date(Date.UTC(2026, 9, 16, 12, 0, second));

function comment(id: string, second: number): TaskCommentRow {
  return {
    id,
    taskId: "t",
    projectId: "p",
    authorId: "u",
    body: id,
    createdAt: at(second),
    editedAt: null,
    updatedAt: at(second),
  };
}

function eventRow(
  id: string,
  second: number,
  type = "priority",
  data: unknown = { from: "none", to: "high" },
): TaskEventRow {
  return {
    id,
    taskId: "t",
    projectId: "p",
    actorId: "u",
    type,
    data,
    createdAt: at(second),
    updatedAt: at(second),
  };
}

const kinds = (items: ReturnType<typeof buildTimeline>) =>
  items.map((item) =>
    item.kind === "fold"
      ? `fold:${item.events.length}`
      : item.kind === "comment"
        ? `comment:${item.comment.id}`
        : `event:${item.event.row.id}`,
  );

describe("buildTimeline", () => {
  it("puts comments and history in one list, oldest first", () => {
    const events = parseEvents([eventRow("e1", 2), eventRow("e2", 6)]);

    expect(
      kinds(buildTimeline([comment("c1", 4), comment("c2", 8)], events)),
    ).toEqual(["event:e1", "comment:c1", "event:e2", "comment:c2"]);
  });

  it("folds three or more entries in a row, and leaves two alone", () => {
    const two = parseEvents([eventRow("e1", 1), eventRow("e2", 2)]);
    const three = parseEvents([
      eventRow("e1", 1),
      eventRow("e2", 2),
      eventRow("e3", 3),
    ]);

    expect(kinds(buildTimeline([], two))).toEqual(["event:e1", "event:e2"]);
    expect(kinds(buildTimeline([], three))).toEqual(["fold:3"]);
  });

  it("counts a run on each side of a comment separately", () => {
    const events = parseEvents([
      eventRow("e1", 1),
      eventRow("e2", 2),
      eventRow("e3", 3),
      eventRow("e4", 5),
      eventRow("e5", 6),
    ]);

    expect(kinds(buildTimeline([comment("c", 4)], events))).toEqual([
      "fold:3",
      "comment:c",
      "event:e4",
      "event:e5",
    ]);
  });

  it("keeps the order of entries that share a moment", () => {
    const events = parseEvents([eventRow("b", 1), eventRow("a", 1)]);
    expect(kinds(buildTimeline([], events))).toEqual(["event:a", "event:b"]);
  });
});

describe("parseEvents", () => {
  it("drops an entry whose type or payload this version does not know", () => {
    const parsed = parseEvents([
      eventRow("ok", 1),
      eventRow("alien", 2, "teleported", {}),
      eventRow("bad", 3, "priority", { from: "none" }),
    ]);

    expect(parsed.map((entry) => entry.row.id)).toEqual(["ok"]);
  });
});
