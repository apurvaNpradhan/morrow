import type { LabelRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { labelsOfTask, sortLabels } from "./label-order";

function label(id: string, position: string): LabelRow {
  const now = new Date(0);
  return {
    id,
    workspaceId: "w",
    name: id,
    color: "#ef4444",
    position,
    createdAt: now,
    updatedAt: now,
  };
}

const bug = label("bug", "a1");
const design = label("design", "a0");
const byId = new Map([bug, design].map((row) => [row.id, row]));

describe("labelsOfTask", () => {
  it("shows a task's labels in the Workspace's order, not the order applied", () => {
    expect(labelsOfTask(["bug", "design"], byId)).toEqual([design, bug]);
  });

  it("leaves out an id that is no longer a label", () => {
    expect(labelsOfTask(["gone", "bug"], byId)).toEqual([bug]);
  });
});

describe("sortLabels", () => {
  it("orders by position as bytes, not as locale text", () => {
    const upper = label("u", "aZ");
    const lower = label("l", "aa");
    expect(sortLabels([lower, upper])).toEqual([upper, lower]);
  });
});
