import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { storyOf } from "./helpers/history";
import { as, columnsOf, rejection } from "./helpers/projects";
import { newTaskId, setupTasks, taskRow, xminOfTask } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const { client, base } = context;
  const parent = await context.addTask("To Do", { title: "Parent" });
  const child = (title = "Child", column = "To Do") =>
    context.addTask(column, { title, parentId: parent.id });
  const target = (taskId: string) => ({ ...base, taskId });
  const counts = async (id: string) => {
    const row = await taskRow(id);
    return [row?.subtaskDone, row?.subtaskTotal];
  };
  const move = (taskId: string, column: string) =>
    client.tasks.move({
      ...target(taskId),
      columnId: context.byName(column).id,
      position: context.nextPosition(context.byName(column).id),
    });
  return { ...context, parent, child, target, counts, move };
}

describe("setting a parent", () => {
  it("sets, changes and clears it, returning the txid", async () => {
    const { client, parent, target, addTask, counts } = await setup();
    const other = await addTask("To Do", { title: "Other" });
    const kid = await addTask("To Do");

    const set = await client.tasks.updateParent({
      ...target(kid.id),
      parentId: parent.id,
    });
    expect(set.txid).toBe(await xminOfTask(kid.id));
    expect((await taskRow(kid.id))?.parentId).toBe(parent.id);
    expect(await counts(parent.id)).toEqual([0, 1]);

    await client.tasks.updateParent({ ...target(kid.id), parentId: other.id });
    expect(await counts(parent.id)).toEqual([0, 0]);
    expect(await counts(other.id)).toEqual([0, 1]);

    await client.tasks.updateParent({ ...target(kid.id), parentId: null });
    expect((await taskRow(kid.id))?.parentId).toBeNull();
    expect(await counts(other.id)).toEqual([0, 0]);
  });

  it("refuses a parent from another project", async () => {
    const { client, base, target, addTask } = await setup();
    const elsewhere = await client.projects.create({
      workspaceId: base.workspaceId,
      name: "Other",
      key: "OTH",
    });
    const columns = await columnsOf(elsewhere.id);
    const foreign = newTaskId();
    await client.tasks.create({
      workspaceId: base.workspaceId,
      projectId: elsewhere.id,
      id: foreign,
      columnId: columns[0]!.id,
      position: "a0",
      title: "Foreign",
    });
    const kid = await addTask();

    const refused = await rejection(
      client.tasks.updateParent({ ...target(kid.id), parentId: foreign }),
    );
    const onCreate = await rejection(addTask("To Do", { parentId: foreign }));

    expect(refused).toMatchObject({ data: { code: "PARENT_NOT_IN_PROJECT" } });
    expect(onCreate).toMatchObject({ data: { code: "PARENT_NOT_IN_PROJECT" } });
  });

  it("refuses a task as its own parent and loops of depth 2 and 3", async () => {
    const { client, parent, target, addTask } = await setup();
    const b = await addTask("To Do", { title: "B", parentId: parent.id });
    const c = await addTask("To Do", { title: "C", parentId: b.id });
    const attempt = (taskId: string, parentId: string) =>
      rejection(client.tasks.updateParent({ ...target(taskId), parentId }));

    for (const refused of [
      await attempt(parent.id, parent.id),
      await attempt(parent.id, b.id),
      await attempt(parent.id, c.id),
      await attempt(b.id, c.id),
    ]) {
      expect(refused).toMatchObject({ data: { code: "PARENT_CYCLE" } });
    }
    expect((await taskRow(parent.id))?.parentId).toBeNull();
  });

  it("refuses a viewer", async () => {
    const { base, parent, target, addTask } = await setup();
    const viewer = await addWorkspaceMember(base.workspaceId, "viewer");
    const kid = await addTask();
    const refused = await rejection(
      as(viewer).tasks.updateParent({
        ...target(kid.id),
        parentId: parent.id,
      }),
    );
    expect(refused).toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("the parent's counters", () => {
  it("follow close, cancel and reopen", async () => {
    const { parent, child, counts, move } = await setup();
    const a = await child("A");
    const b = await child("B");
    expect(await counts(parent.id)).toEqual([0, 2]);

    await move(a.id, "Done");
    expect(await counts(parent.id)).toEqual([1, 2]);
    await move(b.id, "Canceled");
    expect(await counts(parent.id)).toEqual([2, 2]);
    await move(a.id, "To Do");
    expect(await counts(parent.id)).toEqual([1, 2]);
  });

  it("count a subtask created closed", async () => {
    const { parent, child, counts } = await setup();
    await child("Already done", "Done");
    expect(await counts(parent.id)).toEqual([1, 1]);
  });

  it("leave archived subtasks out, and bring them back", async () => {
    const { client, parent, child, counts, target, move } = await setup();
    const a = await child("A");
    const b = await child("B");
    await move(a.id, "Done");

    await client.tasks.archive(target(a.id));
    expect(await counts(parent.id)).toEqual([0, 1]);
    await client.tasks.unarchive(target(a.id));
    expect(await counts(parent.id)).toEqual([1, 2]);

    await move(b.id, "Done");
    await client.tasks.archiveCompleted({
      ...target(a.id),
      columnId: (await taskRow(a.id))!.columnId,
    });
    expect(await counts(parent.id)).toEqual([0, 0]);
  });

  it("drop a deleted subtask, and a deleted parent frees its subtasks", async () => {
    const { client, parent, child, counts, target } = await setup();
    const a = await child("A");
    const b = await child("B");

    await client.tasks.remove(target(a.id));
    expect(await counts(parent.id)).toEqual([0, 1]);

    await client.tasks.remove(target(parent.id));
    const orphan = await taskRow(b.id);
    expect(orphan?.parentId).toBeNull();
  });

  it("follow a column's category change and a column's delete", async () => {
    const { client, base, parent, child, counts, byName } = await setup();
    // The last Done column cannot change category, so use a spare one.
    const spare = await client.projects.columns.create({
      ...base,
      name: "Shipped",
      category: "done",
    });
    const a = await child("A");
    const b = await child("B");
    await child("C");
    for (const task of [a, b]) {
      await client.tasks.move({
        ...base,
        taskId: task.id,
        columnId: spare.id,
        position: "a0",
      });
    }
    expect(await counts(parent.id)).toEqual([2, 3]);

    await client.projects.columns.move({
      ...base,
      columnId: spare.id,
      category: "started",
      position: "a9",
    });
    expect(await counts(parent.id)).toEqual([0, 3]);

    await client.projects.columns.remove({
      ...base,
      columnId: spare.id,
      targetColumnId: byName("Canceled").id,
    });
    expect(await counts(parent.id)).toEqual([2, 3]);
  });

  it("do not touch other rows for a move between two open columns", async () => {
    const { parent, child, move } = await setup();
    const a = await child("A");
    const before = await xminOfTask(parent.id);

    await move(a.id, "In Progress");

    expect(await xminOfTask(parent.id)).toBe(before);
  });
});

describe("duplicating", () => {
  it("makes a sibling and counts it", async () => {
    const { client, parent, child, counts, target } = await setup();
    const a = await child("A");
    const copyId = newTaskId();

    await client.tasks.duplicate({
      ...target(a.id),
      id: copyId,
      position: "a5",
    });

    expect((await taskRow(copyId))?.parentId).toBe(parent.id);
    expect(await counts(parent.id)).toEqual([0, 2]);
  });

  it("copies neither children nor the parent link of a parent", async () => {
    const { client, parent, child, target } = await setup();
    await child("A");
    const copyId = newTaskId();

    await client.tasks.duplicate({
      ...target(parent.id),
      id: copyId,
      position: "a6",
    });

    const copy = await taskRow(copyId);
    expect(copy).toMatchObject({ parentId: null, subtaskTotal: 0 });
  });
});

describe("history", () => {
  it("lands on the child and on both parents", async () => {
    const { client, parent, target, addTask } = await setup();
    const other = await addTask("To Do", { title: "Other" });
    const kid = await addTask();

    await client.tasks.updateParent({
      ...target(kid.id),
      parentId: parent.id,
    });
    await client.tasks.updateParent({ ...target(kid.id), parentId: other.id });
    await client.tasks.updateParent({ ...target(kid.id), parentId: null });

    expect((await storyOf(kid.id)).slice(1)).toEqual([
      { type: "parent", data: { from: null, to: "MOR-1" } },
      { type: "parent", data: { from: "MOR-1", to: "MOR-2" } },
      { type: "parent", data: { from: "MOR-2", to: null } },
    ]);
    expect((await storyOf(parent.id)).slice(1)).toEqual([
      { type: "subtask_added", data: { ticketId: "MOR-3" } },
      { type: "subtask_removed", data: { ticketId: "MOR-3" } },
    ]);
    expect((await storyOf(other.id)).slice(1)).toEqual([
      { type: "subtask_added", data: { ticketId: "MOR-3" } },
      { type: "subtask_removed", data: { ticketId: "MOR-3" } },
    ]);
  });

  it("keeps the ticket id of a deleted subtask on its parent", async () => {
    const { client, parent, child, target } = await setup();
    const a = await child("A");
    await client.tasks.remove(target(a.id));

    expect((await storyOf(parent.id)).slice(1)).toEqual([
      { type: "subtask_added", data: { ticketId: "MOR-2" } },
      { type: "subtask_removed", data: { ticketId: "MOR-2" } },
    ]);
  });
});
