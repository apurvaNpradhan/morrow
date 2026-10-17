import type { TaskEvent } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { foldTaskEvent, type LatestTaskEvent } from "./fold-task-event";

const now = new Date("2026-10-16T12:00:00Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

const title = (from: string, to: string): TaskEvent => ({
  type: "title",
  data: { from, to },
});
const priority = (
  from: "none" | "low" | "high",
  to: "none" | "low" | "high",
): TaskEvent => ({ type: "priority", data: { from, to } });
const column = (from: string, to: string): TaskEvent => ({
  type: "column",
  data: {
    from: { id: from, name: from.toUpperCase(), category: "started" },
    to: { id: to, name: to.toUpperCase(), category: "done" },
  },
});
const person = (id: string | null) => (id ? { id, name: `Name ${id}` } : null);
const assignee = (from: string | null, to: string | null): TaskEvent => ({
  type: "assignee",
  data: { from: person(from), to: person(to) },
});
const label = (id: string) => ({ id, name: `L ${id}`, color: "red" as const });
const labels = (added: string[], removed: string[] = []): TaskEvent => ({
  type: "labels",
  data: { added: added.map(label), removed: removed.map(label) },
});

function latest(
  event: TaskEvent,
  { actor = "u1", ago = 1 }: { actor?: string | null; ago?: number } = {},
): LatestTaskEvent {
  return { actorId: actor, event, updatedAt: minutesAgo(ago) };
}
const change = (event: TaskEvent, actor: string | null = "u1") => ({
  actorId: actor,
  event,
});

describe("foldTaskEvent", () => {
  it("inserts the first event of a task", () => {
    expect(foldTaskEvent(null, change(title("a", "b")), now)).toEqual({
      kind: "insert",
    });
  });

  it("folds the same person's same field within the window, keeping the first from", () => {
    expect(
      foldTaskEvent(latest(title("a", "b")), change(title("b", "c")), now),
    ).toEqual({ kind: "merge", data: { from: "a", to: "c" } });
  });

  it("measures the window from the last write and ends it after ten minutes", () => {
    expect(
      foldTaskEvent(
        latest(title("a", "b"), { ago: 10 }),
        change(title("b", "c")),
        now,
      ).kind,
    ).toBe("merge");
    expect(
      foldTaskEvent(
        latest(title("a", "b"), { ago: 10.5 }),
        change(title("b", "c")),
        now,
      ).kind,
    ).toBe("insert");
  });

  it("inserts for another person, another field, or an unknown actor", () => {
    const last = latest(title("a", "b"));
    expect(foldTaskEvent(last, change(title("b", "c"), "u2"), now).kind).toBe(
      "insert",
    );
    expect(foldTaskEvent(last, change(priority("none", "low")), now).kind).toBe(
      "insert",
    );
    expect(
      foldTaskEvent(
        latest(title("a", "b"), { actor: null }),
        change(title("b", "c"), null),
        now,
      ).kind,
    ).toBe("insert");
  });

  it("deletes the event when the change is undone", () => {
    expect(
      foldTaskEvent(latest(title("a", "b")), change(title("b", "a")), now),
    ).toEqual({ kind: "delete" });
    expect(
      foldTaskEvent(
        latest(priority("none", "high")),
        change(priority("high", "none")),
        now,
      ),
    ).toEqual({ kind: "delete" });
  });

  it("compares a Column or an assignee by id, not by name", () => {
    expect(
      foldTaskEvent(latest(column("a", "b")), change(column("b", "a")), now),
    ).toEqual({ kind: "delete" });
    expect(
      foldTaskEvent(
        latest(assignee(null, "x")),
        change(assignee("x", null)),
        now,
      ),
    ).toEqual({ kind: "delete" });
    const merged = foldTaskEvent(
      latest(column("a", "b")),
      change(column("b", "c")),
      now,
    );
    expect(merged).toMatchObject({
      kind: "merge",
      data: { from: { id: "a" }, to: { id: "c" } },
    });
  });

  it("folds label sets: a label added then removed cancels out", () => {
    expect(
      foldTaskEvent(latest(labels(["a"])), change(labels(["b"])), now),
    ).toEqual({
      kind: "merge",
      data: { added: [label("a"), label("b")], removed: [] },
    });
    expect(
      foldTaskEvent(latest(labels(["a"])), change(labels([], ["a"])), now),
    ).toEqual({ kind: "delete" });
    expect(
      foldTaskEvent(latest(labels([], ["a"])), change(labels(["a"])), now),
    ).toEqual({ kind: "delete" });
    expect(
      foldTaskEvent(
        latest(labels(["a"], ["x"])),
        change(labels([], ["a"])),
        now,
      ),
    ).toEqual({ kind: "merge", data: { added: [], removed: [label("x")] } });
  });

  it("folds description edits into one", () => {
    expect(
      foldTaskEvent(
        latest({ type: "description", data: {} }),
        change({ type: "description", data: {} }),
        now,
      ),
    ).toEqual({ kind: "merge", data: {} });
  });

  it("never folds a beginning or an archive", () => {
    for (const type of [
      "created",
      "imported",
      "archived",
      "unarchived",
    ] as const) {
      expect(
        foldTaskEvent(
          latest({ type, data: {} }),
          change({ type, data: {} }),
          now,
        ).kind,
      ).toBe("insert");
    }
  });
});
