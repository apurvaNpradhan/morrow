import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import { newTaskId, positionAt, setupTasks, taskRow } from "./helpers/tasks";
import { columnsOf } from "./helpers/projects";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const { client, base, workspace } = context;
  const other = await client.projects.create({
    workspaceId: workspace.id,
    name: "Other",
    key: "OTH",
  });
  const otherColumns = await columnsOf(other.id);
  const otherBase = { workspaceId: workspace.id, projectId: other.id };
  let placed = 0;
  const addElsewhere = async (columnName = "To Do") => {
    const id = newTaskId();
    await client.tasks.create({
      ...otherBase,
      id,
      columnId: otherColumns.find((c) => c.name === columnName)!.id,
      position: positionAt(placed++),
      title: "Elsewhere",
    });
    return { id };
  };
  const blocks = (sourceTaskId: string, targetTaskId: string) =>
    client.relations.add({
      workspaceId: workspace.id,
      id: newTaskId(),
      type: "blocks",
      sourceTaskId,
      targetTaskId,
    });
  const count = async (id: string) => (await taskRow(id))?.openBlockerCount;
  const move = (taskId: string, column: string) =>
    client.tasks.move({
      ...base,
      taskId,
      columnId: context.byName(column).id,
      position: context.nextPosition(context.byName(column).id),
    });
  const target = (taskId: string) => ({ ...base, taskId });
  return { ...context, addElsewhere, blocks, count, move, target, otherBase };
}

describe("open_blocker_count", () => {
  it("counts open blockers as relations are added and removed", async () => {
    const { client, base, workspace, addTask, blocks, count } = await setup();
    const a = await addTask();
    const b = await addTask();
    const c = await addTask();

    await blocks(a.id, c.id);
    await blocks(b.id, c.id);
    expect(await count(c.id)).toBe(2);
    expect(await count(a.id)).toBe(0);

    const task = await client.tasks.get({ ...base, ticketId: "MOR-3" });
    expect(task.openBlockerCount).toBe(2);

    const [relation] = task.relations.filter((r) => r.kind === "blocked_by");
    await client.relations.delete({
      workspaceId: workspace.id,
      relationId: relation!.id,
    });
    expect(await count(c.id)).toBe(1);
  });

  it("ignores related and duplicate relations", async () => {
    const { client, workspace, addTask, count } = await setup();
    const a = await addTask();
    const b = await addTask();
    for (const type of ["related", "duplicate"] as const) {
      await client.relations.add({
        workspaceId: workspace.id,
        id: newTaskId(),
        type,
        sourceTaskId: a.id,
        targetTaskId: b.id,
      });
    }
    expect(await count(b.id)).toBe(0);
  });

  it("starts at 0 when the blocker is already closed", async () => {
    const { addTask, blocks, count } = await setup();
    const a = await addTask("Done");
    const b = await addTask();

    await blocks(a.id, b.id);

    expect(await count(b.id)).toBe(0);
  });

  it("follows the blocker closing, reopening and being canceled", async () => {
    const { addTask, blocks, count, move } = await setup();
    const a = await addTask();
    const b = await addTask();
    await blocks(a.id, b.id);

    await move(a.id, "In Progress");
    expect(await count(b.id)).toBe(1);
    await move(a.id, "Done");
    expect(await count(b.id)).toBe(0);
    await move(a.id, "To Do");
    expect(await count(b.id)).toBe(1);
    await move(a.id, "Canceled");
    expect(await count(b.id)).toBe(0);
  });

  it("follows the blocker being archived, unarchived and deleted", async () => {
    const { client, addTask, blocks, count, target } = await setup();
    const a = await addTask();
    const b = await addTask();
    const c = await addTask();
    await blocks(a.id, b.id);
    await blocks(c.id, b.id);

    await client.tasks.archive(target(a.id));
    expect(await count(b.id)).toBe(1);
    await client.tasks.unarchive(target(a.id));
    expect(await count(b.id)).toBe(2);
    await client.tasks.remove(target(a.id));
    expect(await count(b.id)).toBe(1);
  });

  it("follows archive-completed and column changes", async () => {
    const { client, base, addTask, blocks, count, move, byName } =
      await setup();
    const a = await addTask("Done");
    const b = await addTask();
    const spare = await client.projects.columns.create({
      ...base,
      name: "Shipped",
      category: "done",
    });
    const c = await addTask();
    await blocks(c.id, b.id);
    await move(c.id, "Done");
    await client.tasks.move({
      ...base,
      taskId: c.id,
      columnId: spare.id,
      position: "a0",
    });
    expect(await count(b.id)).toBe(0);

    await client.projects.columns.move({
      ...base,
      columnId: spare.id,
      category: "started",
      position: "a9",
    });
    expect(await count(b.id)).toBe(1);

    await client.projects.columns.remove({
      ...base,
      columnId: spare.id,
      targetColumnId: byName("Canceled").id,
    });
    expect(await count(b.id)).toBe(0);

    await blocks(a.id, b.id);
    expect(await count(b.id)).toBe(0);
    await client.tasks.archiveCompleted({
      ...base,
      columnId: byName("Done").id,
    });
    expect(await count(b.id)).toBe(0);
  });

  it("follows a blocker in another project", async () => {
    const { client, addTask, addElsewhere, blocks, count, otherBase } =
      await setup();
    const a = await addElsewhere();
    const b = await addTask();
    await blocks(a.id, b.id);
    expect(await count(b.id)).toBe(1);

    const done = (await columnsOf(otherBase.projectId)).find(
      (c) => c.name === "Done",
    )!;
    await client.tasks.move({
      ...otherBase,
      taskId: a.id,
      columnId: done.id,
      position: "a0",
    });

    expect(await count(b.id)).toBe(0);
  });

  it("ends at 0 when a link and the close of the blocker race, in both orders", async () => {
    const { addTask, blocks, count, move } = await setup();
    for (const closeFirst of [false, true]) {
      for (let round = 0; round < 8; round++) {
        const a = await addTask();
        const b = await addTask();
        const link = () => blocks(a.id, b.id);
        const close = () => move(a.id, "Done");
        await Promise.all(closeFirst ? [close(), link()] : [link(), close()]);
        expect(await count(b.id)).toBe(0);
      }
    }
  });
});
