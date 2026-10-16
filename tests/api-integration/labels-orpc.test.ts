import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { labelFactory, labelRows, newLabelId } from "./helpers/labels";
import { as, rejection } from "./helpers/projects";
import { newTaskId, positionAt, setupTasks, taskRow } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const addLabel = labelFactory(context.client, context.workspace.id);
  const apply = (taskId: string, labelId: string) =>
    context.client.tasks.addLabel({ ...context.base, taskId, labelId });
  return { ...context, addLabel, apply };
}

async function xminOfLabel(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM label WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("creating a label", () => {
  it("stores what the client chose and returns the txid", async () => {
    const { client, workspace } = await setup();
    const id = newLabelId();

    const created = await client.labels.create({
      workspaceId: workspace.id,
      id,
      name: "  Bug  ",
      color: "red",
      position: positionAt(0),
    });

    expect(created.txid).toBe(await xminOfLabel(id));
    expect(await labelRows(workspace.id)).toMatchObject([
      { id, name: "Bug", color: "red", position: positionAt(0) },
    ]);
  });

  it("refuses a name that exists in any letter case", async () => {
    const { client, workspace, addLabel } = await setup();
    await addLabel("Bug");

    const duplicate = await rejection(
      client.labels.create({
        workspaceId: workspace.id,
        id: newLabelId(),
        name: "bUG",
        color: "blue",
        position: positionAt(5),
      }),
    );

    expect(duplicate.data?.code).toBe("LABEL_NAME_TAKEN");
  });

  it("allows the same name in another workspace", async () => {
    const { addLabel } = await setup();
    const other = await setup();
    await addLabel("Bug");

    await expect(other.addLabel("Bug")).resolves.toBeDefined();
  });

  it("refuses a bad id, a bad position, a taken position, a long name and a colour off the palette", async () => {
    const { client, workspace, addLabel } = await setup();
    await addLabel("First");
    const create = (input: Record<string, unknown>) =>
      client.labels.create({
        workspaceId: workspace.id,
        id: newLabelId(),
        name: "Second",
        color: "blue",
        position: positionAt(5),
        ...input,
      } as Parameters<typeof client.labels.create>[0]);

    const badId = await rejection(create({ id: "not-a-cuid" }));
    const badPosition = await rejection(create({ position: "not a key" }));
    const taken = await rejection(create({ position: positionAt(0) }));
    const tooLong = await rejection(create({ name: "x".repeat(51) }));
    const empty = await rejection(create({ name: "   " }));
    const offPalette = await rejection(create({ color: "chartreuse" }));

    expect(badId.data?.code).toBe("INVALID_LABEL_ID");
    expect(badPosition.data?.code).toBe("INVALID_POSITION");
    expect(taken.data?.code).toBe("POSITION_TAKEN");
    for (const refusal of [tooLong, empty, offPalette]) {
      expect(refusal.code).toBe("BAD_REQUEST");
    }
  });
});

describe("changing a label", () => {
  it("renames, recolours and moves it, each with a txid", async () => {
    const { client, workspace, addLabel } = await setup();
    const { id } = await addLabel("Bug");

    const renamed = await client.labels.update({
      workspaceId: workspace.id,
      labelId: id,
      name: "Defect",
    });
    const recoloured = await client.labels.update({
      workspaceId: workspace.id,
      labelId: id,
      color: "violet",
    });
    const moved = await client.labels.move({
      workspaceId: workspace.id,
      labelId: id,
      position: positionAt(9),
    });

    expect(renamed.txid).toBeLessThan(recoloured.txid);
    expect(moved.txid).toBe(await xminOfLabel(id));
    expect(await labelRows(workspace.id)).toMatchObject([
      { id, name: "Defect", color: "violet", position: positionAt(9) },
    ]);
  });

  it("refuses a rename to a name another label has", async () => {
    const { client, workspace, addLabel } = await setup();
    await addLabel("Bug");
    const design = await addLabel("Design");

    const clash = await rejection(
      client.labels.update({
        workspaceId: workspace.id,
        labelId: design.id,
        name: "bug",
      }),
    );

    expect(clash.data?.code).toBe("LABEL_NAME_TAKEN");
  });

  it("does not reach a label of another workspace", async () => {
    const { client, workspace } = await setup();
    const other = await setup();
    const foreign = await other.addLabel("Foreign");

    const refusal = await rejection(
      client.labels.update({
        workspaceId: workspace.id,
        labelId: foreign.id,
        name: "Mine",
      }),
    );

    expect(refusal.code).toBe("NOT_FOUND");
  });
});

describe("applying labels to a task", () => {
  it("adds and removes a label, idempotently, with a txid", async () => {
    const { client, base, addTask, addLabel, apply } = await setup();
    const { id: taskId } = await addTask();
    const bug = await addLabel("Bug");

    const first = await apply(taskId, bug.id);
    await apply(taskId, bug.id);
    expect((await taskRow(taskId))?.labelIds).toEqual([bug.id]);
    const removed = await client.tasks.removeLabel({
      ...base,
      taskId,
      labelId: bug.id,
    });
    await client.tasks.removeLabel({ ...base, taskId, labelId: bug.id });

    expect(first.txid).toBeGreaterThan(0);
    expect(removed.txid).toBeGreaterThan(first.txid);
    expect((await taskRow(taskId))?.labelIds).toEqual([]);
  });

  it("refuses a label of another workspace", async () => {
    const { addTask, apply } = await setup();
    const other = await setup();
    const foreign = await other.addLabel("Foreign");
    const { id: taskId } = await addTask();

    const refusal = await rejection(apply(taskId, foreign.id));

    expect(refusal.code).toBe("NOT_FOUND");
    expect((await taskRow(taskId))?.labelIds).toEqual([]);
  });

  it("refuses a 21st label but lets an applied one be applied again", async () => {
    const { addTask, addLabel, apply } = await setup();
    const { id: taskId } = await addTask();
    const labels = [];
    for (let n = 0; n < 21; n++) labels.push(await addLabel(`Label ${n}`));
    for (const label of labels.slice(0, 20)) await apply(taskId, label.id);

    const overflow = await rejection(apply(taskId, labels[20]!.id));
    await apply(taskId, labels[0]!.id);

    expect(overflow.data?.code).toBe("LABEL_LIMIT_REACHED");
    expect((await taskRow(taskId))?.labelIds).toHaveLength(20);
  });

  it("keeps both labels when two people label one task at once", async () => {
    const { workspace, addTask, addLabel, apply } = await setup();
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const { id: taskId } = await addTask();
    const bug = await addLabel("Bug");
    const design = await addLabel("Design");
    const theirs = as(colleague);

    await Promise.all([
      apply(taskId, bug.id),
      theirs.tasks.addLabel({
        workspaceId: workspace.id,
        projectId: (await taskRow(taskId))!.projectId,
        taskId,
        labelId: design.id,
      }),
    ]);

    expect((await taskRow(taskId))?.labelIds.toSorted()).toEqual(
      [bug.id, design.id].toSorted(),
    );
  });

  it("keeps the task's other fields when a label is applied", async () => {
    const { addTask, addLabel, apply } = await setup();
    const { id: taskId } = await addTask("To Do", { title: "Keep me" });
    const before = await taskRow(taskId);

    await apply(taskId, (await addLabel("Bug")).id);

    expect(await taskRow(taskId)).toMatchObject({
      title: "Keep me",
      columnId: before?.columnId,
      position: before?.position,
    });
  });
});

describe("duplicating a labelled task", () => {
  it("keeps the labels on the copy", async () => {
    const { client, base, addTask, addLabel, apply } = await setup();
    const bug = await addLabel("Bug");
    const { id: sourceId } = await addTask();
    await apply(sourceId, bug.id);
    const copyId = newTaskId();

    await client.tasks.duplicate({
      ...base,
      taskId: sourceId,
      id: copyId,
      position: positionAt(9),
    });

    expect((await taskRow(copyId))?.labelIds).toEqual([bug.id]);
  });
});

describe("deleting a label", () => {
  it("strips it from every task of the workspace and leaves other labels", async () => {
    const { client, workspace, addTask, addLabel, apply } = await setup();
    const bug = await addLabel("Bug");
    const design = await addLabel("Design");
    const one = await addTask();
    const two = await addTask("Done");
    await apply(one.id, bug.id);
    await apply(one.id, design.id);
    await apply(two.id, bug.id);

    const usage = await client.labels.usage({ workspaceId: workspace.id });
    const deleted = await client.labels.delete({
      workspaceId: workspace.id,
      labelId: bug.id,
    });

    expect(usage.find((row) => row.labelId === bug.id)?.count).toBe(2);
    expect(deleted.txid).toBeGreaterThan(0);
    expect((await taskRow(one.id))?.labelIds).toEqual([design.id]);
    expect((await taskRow(two.id))?.labelIds).toEqual([]);
    expect(await labelRows(workspace.id)).toHaveLength(1);
  });

  it("leaves the tasks of other workspaces alone", async () => {
    const { client, workspace, addLabel } = await setup();
    const other = await setup();
    const bug = await addLabel("Bug");
    const theirs = await other.addTask();
    // A foreign task cannot hold this label through the API, so plant the id.
    await db
      .update(schema.taskTable)
      .set({ labelIds: [bug.id] })
      .where(eq(schema.taskTable.id, theirs.id));

    await client.labels.delete({ workspaceId: workspace.id, labelId: bug.id });

    expect((await taskRow(theirs.id))?.labelIds).toEqual([bug.id]);
  });

  it("is not raced by an apply: the label is gone or the strip comes after", async () => {
    const { client, workspace, addTask, addLabel, apply } = await setup();
    const bug = await addLabel("Bug");
    const { id: taskId } = await addTask();

    const results = await Promise.allSettled([
      apply(taskId, bug.id),
      client.labels.delete({ workspaceId: workspace.id, labelId: bug.id }),
    ]);

    expect(results[1]?.status).toBe("fulfilled");
    expect((await taskRow(taskId))?.labelIds).toEqual([]);
  });
});

describe("label permissions", () => {
  it("lets a member create and apply but not rename, move or delete", async () => {
    const { workspace, addTask, addLabel } = await setup();
    const bug = await addLabel("Bug");
    const { id: taskId } = await addTask();
    const member = as(await addWorkspaceMember(workspace.id, "member"));

    const created = await member.labels.create({
      workspaceId: workspace.id,
      id: newLabelId(),
      name: "Mine",
      color: "teal",
      position: positionAt(9),
    });
    const applied = await member.tasks.addLabel({
      workspaceId: workspace.id,
      projectId: (await taskRow(taskId))!.projectId,
      taskId,
      labelId: bug.id,
    });
    const refusals = await Promise.all([
      rejection(
        member.labels.update({
          workspaceId: workspace.id,
          labelId: bug.id,
          name: "x",
        }),
      ),
      rejection(
        member.labels.move({
          workspaceId: workspace.id,
          labelId: bug.id,
          position: positionAt(20),
        }),
      ),
      rejection(
        member.labels.delete({ workspaceId: workspace.id, labelId: bug.id }),
      ),
    ]);

    expect(created.txid).toBeGreaterThan(0);
    expect(applied.txid).toBeGreaterThan(0);
    for (const refusal of refusals) expect(refusal.code).toBe("FORBIDDEN");
    expect((await taskRow(taskId))?.labelIds).toEqual([bug.id]);
  });

  it("lets a viewer read but not create or apply", async () => {
    const { workspace, addTask, addLabel } = await setup();
    const bug = await addLabel("Bug");
    const { id: taskId } = await addTask();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const usage = await viewer.labels.usage({ workspaceId: workspace.id });
    const create = await rejection(
      viewer.labels.create({
        workspaceId: workspace.id,
        id: newLabelId(),
        name: "Mine",
        color: "teal",
        position: positionAt(9),
      }),
    );
    const apply = await rejection(
      viewer.tasks.addLabel({
        workspaceId: workspace.id,
        projectId: (await taskRow(taskId))!.projectId,
        taskId,
        labelId: bug.id,
      }),
    );

    expect(usage).toEqual([]);
    expect(create.code).toBe("FORBIDDEN");
    expect(apply.code).toBe("FORBIDDEN");
  });

  it("lets an admin do everything", async () => {
    const { workspace, addLabel } = await setup();
    const bug = await addLabel("Bug");
    const admin = as(await addWorkspaceMember(workspace.id, "admin"));

    await admin.labels.update({
      workspaceId: workspace.id,
      labelId: bug.id,
      name: "Defect",
    });
    await admin.labels.delete({ workspaceId: workspace.id, labelId: bug.id });

    expect(await labelRows(workspace.id)).toEqual([]);
  });

  it("does not let a stranger touch another workspace's labels", async () => {
    const { workspace, addLabel } = await setup();
    const bug = await addLabel("Bug");
    const stranger = as((await setup()).owner);

    const refusal = await rejection(
      stranger.labels.delete({ workspaceId: workspace.id, labelId: bug.id }),
    );

    expect(refusal.code).toBe("NOT_FOUND");
    expect(await labelRows(workspace.id)).toHaveLength(1);
  });
});
