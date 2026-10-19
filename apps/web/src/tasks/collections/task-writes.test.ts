import type { TaskRow } from "@morrow/sync-schemas";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const rpc = vi.hoisted(() => {
  const call = (txid: number | null) => vi.fn().mockResolvedValue({ txid });
  return {
    tasks: {
      updateTitle: call(1),
      updateDescription: call(2),
      updatePriority: call(3),
      updateDueDate: call(4),
      updateAssignee: call(5),
      updateParent: call(9),
      move: call(6),
      archive: call(7),
      unarchive: call(8),
      setFieldValue: call(9),
    },
  };
});

vi.mock("@/app/lib/orpc", () => ({ rpc }));
vi.mock("@/projects", () => ({
  projectCollection: {
    get: (id: string) => (id === "p1" ? { workspaceId: "w1" } : undefined),
  },
}));

const { workspaceOf, writeTaskChanges } = await import("./task-writes");

const original = {
  id: "t1",
  projectId: "p1",
  columnId: "todo",
  position: "a0",
} as TaskRow;

beforeEach(() => {
  for (const call of Object.values(rpc.tasks)) call.mockClear();
});

describe("writeTaskChanges", () => {
  it("sends one Procedure per field group the edit touched, and nothing else", async () => {
    const txids = await writeTaskChanges({
      original,
      changes: { title: "New", priority: "high" },
    });

    expect(rpc.tasks.updateTitle).toHaveBeenCalledWith({
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      title: "New",
    });
    expect(rpc.tasks.updatePriority).toHaveBeenCalledTimes(1);
    expect(rpc.tasks.updateDescription).not.toHaveBeenCalled();
    expect(rpc.tasks.move).not.toHaveBeenCalled();
    expect(txids).toEqual([1, 3]);
  });

  it("sends a parent change, and a cleared parent as null", async () => {
    await writeTaskChanges({ original, changes: { parentId: "t0" } });
    await writeTaskChanges({ original, changes: { parentId: null } });

    expect(rpc.tasks.updateParent).toHaveBeenNthCalledWith(1, {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      parentId: "t0",
    });
    expect(rpc.tasks.updateParent).toHaveBeenNthCalledWith(2, {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      parentId: null,
    });
  });

  it("sends a move with the Column and position, filling in whichever did not change", async () => {
    await writeTaskChanges({ original, changes: { position: "a5" } });
    await writeTaskChanges({ original, changes: { columnId: "done" } });

    expect(rpc.tasks.move).toHaveBeenNthCalledWith(1, {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      columnId: "todo",
      position: "a5",
    });
    expect(rpc.tasks.move).toHaveBeenNthCalledWith(2, {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      columnId: "done",
      position: "a0",
    });
  });

  it("clears a due date and an assignee with null, and keeps completion out of it", async () => {
    await writeTaskChanges({
      original,
      changes: { dueDate: null, assigneeId: null, completedAt: new Date() },
    });

    expect(rpc.tasks.updateDueDate).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: null }),
    );
    expect(rpc.tasks.updateAssignee).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: null }),
    );
    expect(rpc.tasks.move).not.toHaveBeenCalled();
  });

  it("archives or unarchives by the new value", async () => {
    await writeTaskChanges({ original, changes: { archivedAt: new Date() } });
    await writeTaskChanges({ original, changes: { archivedAt: null } });

    expect(rpc.tasks.archive).toHaveBeenCalledTimes(1);
    expect(rpc.tasks.unarchive).toHaveBeenCalledTimes(1);
  });

  it("sets, changes and clears Field values one Field at a time, leaving the others alone", async () => {
    const holding = {
      ...original,
      fieldValues: { size: "small", customer: "acme", kept: "x" },
    } as TaskRow;

    const txids = await writeTaskChanges({
      original: holding,
      changes: {
        fieldValues: { size: "large", kept: "x", team: "red" },
      },
    });

    const target = { workspaceId: "w1", projectId: "p1", taskId: "t1" };
    expect(rpc.tasks.setFieldValue).toHaveBeenCalledTimes(3);
    expect(rpc.tasks.setFieldValue).toHaveBeenCalledWith({
      ...target,
      fieldId: "size",
      value: "large",
    });
    expect(rpc.tasks.setFieldValue).toHaveBeenCalledWith({
      ...target,
      fieldId: "team",
      value: "red",
    });
    expect(rpc.tasks.setFieldValue).toHaveBeenCalledWith({
      ...target,
      fieldId: "customer",
      value: null,
    });
    expect(txids).toEqual([9, 9, 9]);
  });

  it("skips a txid the server did not give", async () => {
    rpc.tasks.updateTitle.mockResolvedValueOnce({ txid: null });
    expect(
      await writeTaskChanges({ original, changes: { title: "Same" } }),
    ).toEqual([]);
  });
});

describe("workspaceOf", () => {
  it("names the workspace of a loaded project and refuses an unknown one", () => {
    expect(workspaceOf("p1")).toBe("w1");
    expect(() => workspaceOf("missing")).toThrow("Project is not loaded");
  });
});
