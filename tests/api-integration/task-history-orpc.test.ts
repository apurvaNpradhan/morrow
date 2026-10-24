import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { ageEvents, eventsOf, storyOf } from "./helpers/history";
import { labelFactory } from "./helpers/labels";
import { as } from "./helpers/projects";
import { positionAt, setupTasks } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const { client, base } = context;
  const { id: taskId, ...created } = await context.addTask("To Do", {
    title: "Original",
  });
  const target = { ...base, taskId };
  return {
    ...context,
    taskId,
    created,
    target,
    addLabel: labelFactory(client, context.workspace.id),
  };
}

describe("what a task's history records", () => {
  it("starts with who created it", async () => {
    const { taskId, owner } = await setup();

    const [first, ...rest] = await eventsOf(taskId);

    expect(first).toMatchObject({
      type: "created",
      data: {},
      actorId: owner.id,
    });
    expect(rest).toEqual([]);
  });

  it("names the original for a duplicate", async () => {
    const { client, base, taskId } = await setup();
    const copyId = "c" + "0".repeat(23);

    await client.tasks.duplicate({
      ...base,
      taskId,
      id: copyId,
      position: positionAt(9),
    });

    expect(await storyOf(copyId)).toEqual([
      { type: "duplicated", data: { sourceTicketId: "MOR-1" } },
    ]);
  });

  it("records a title, priority, due date and assignee change with from and to", async () => {
    const { client, target, taskId, owner } = await setup();

    await client.tasks.updateTitle({ ...target, title: "Renamed" });
    await client.tasks.updatePriority({ ...target, priority: "urgent" });
    await client.tasks.updateDueDate({ ...target, dueDate: "2026-12-31" });
    await client.tasks.updateAssignee({ ...target, assigneeId: owner.id });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      { type: "title", data: { from: "Original", to: "Renamed" } },
      { type: "priority", data: { from: "none", to: "urgent" } },
      { type: "due_date", data: { from: null, to: "2026-12-31" } },
      {
        type: "assignee",
        data: { from: null, to: { id: owner.id, name: owner.name } },
      },
    ]);
  });

  it("records a due moment in UTC and nothing when the same moment comes in another offset", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateDueDate({
      ...target,
      dueDate: "2026-12-31T15:00:00+05:30",
    });
    await client.tasks.updateDueDate({
      ...target,
      dueDate: "2026-12-31T09:30:00Z",
    });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      {
        type: "due_date",
        data: { from: null, to: "2026-12-31T09:30:00.000Z" },
      },
    ]);
  });

  it("records a start date change, with the time when there is one", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateStartDate({
      ...target,
      startDate: "2026-12-20T09:00:00+01:00",
    });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      {
        type: "start_date",
        data: { from: null, to: "2026-12-20T08:00:00.000Z" },
      },
    ]);
  });

  it("records the start a due date took along", async () => {
    const { client, base, addTask } = await setup();
    const { id } = await addTask("To Do", {
      startDate: "2026-12-20",
      dueDate: "2026-12-31",
    });

    await client.tasks.updateDueDate({
      ...base,
      taskId: id,
      dueDate: "2026-12-10",
    });

    expect((await storyOf(id)).slice(1)).toEqual([
      { type: "start_date", data: { from: "2026-12-20", to: null } },
      {
        type: "due_date",
        data: { from: "2026-12-31", to: "2026-12-10" },
      },
    ]);
  });

  it("records a move to another column with both columns, and an archive and unarchive", async () => {
    const { client, target, taskId, byName } = await setup();

    await client.tasks.move({
      ...target,
      columnId: byName("Done").id,
      position: positionAt(0),
    });
    await client.tasks.archive(target);
    await client.tasks.unarchive(target);

    expect((await storyOf(taskId)).slice(1)).toEqual([
      {
        type: "column",
        data: {
          from: {
            id: byName("To Do").id,
            name: "To Do",
            category: "unstarted",
          },
          to: { id: byName("Done").id, name: "Done", category: "done" },
        },
      },
      { type: "archived", data: {} },
      { type: "unarchived", data: {} },
    ]);
  });

  it("records label additions and removals with a snapshot of the label", async () => {
    const { client, target, taskId, addLabel } = await setup();
    const bug = await addLabel("Bug");
    const design = await addLabel("Design");

    await client.tasks.addLabel({ ...target, labelId: bug.id });
    await client.tasks.addLabel({ ...target, labelId: design.id });
    await client.tasks.removeLabel({ ...target, labelId: bug.id });

    // One person's run of label changes folds into one entry.
    expect((await storyOf(taskId)).slice(1)).toEqual([
      {
        type: "labels",
        data: {
          added: [{ id: design.id, name: "Design", color: "#ef4444" }],
          removed: [],
        },
      },
    ]);
  });

  it("records a description edit without its text", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateDescription({ ...target, description: "# Plan" });

    const [, description] = await eventsOf(taskId);
    expect(description).toMatchObject({ type: "description", data: {} });
  });

  it("is removed with its task", async () => {
    const { client, target, taskId } = await setup();
    await client.tasks.updatePriority({ ...target, priority: "high" });

    await client.tasks.remove(target);

    expect(await eventsOf(taskId)).toEqual([]);
  });
});

describe("what it does not record", () => {
  it("ignores a write that changes nothing and a reorder within a column", async () => {
    const { client, target, taskId, byName } = await setup();

    await client.tasks.updateTitle({ ...target, title: "Original" });
    await client.tasks.updatePriority({ ...target, priority: "none" });
    await client.tasks.updateDescription({ ...target, description: "" });
    await client.tasks.move({
      ...target,
      columnId: byName("To Do").id,
      position: positionAt(7),
    });
    await client.tasks.archive(target);
    await client.tasks.archive(target);

    expect((await storyOf(taskId)).map((event) => event.type)).toEqual([
      "created",
      "archived",
    ]);
  });

  it("writes nothing for a deleted column, a category change, a deleted label or a new key", async () => {
    const { client, workspace, projectId, target, taskId, byName, addLabel } =
      await setup();
    const bug = await addLabel("Bug");
    await client.tasks.addLabel({ ...target, labelId: bug.id });
    await client.tasks.move({
      ...target,
      columnId: byName("In Progress").id,
      position: positionAt(0),
    });
    const before = await storyOf(taskId);

    // The column the task sits in is deleted: its tasks move to another.
    await client.projects.columns.remove({
      workspaceId: workspace.id,
      projectId,
      columnId: byName("In Progress").id,
      targetColumnId: byName("Backlog").id,
    });
    // That column changes category, which completes its tasks.
    await client.projects.columns.move({
      workspaceId: workspace.id,
      projectId,
      columnId: byName("Backlog").id,
      category: "done",
      position: positionAt(5),
    });
    await client.labels.delete({ workspaceId: workspace.id, labelId: bug.id });
    await client.projects.changeKey({
      workspaceId: workspace.id,
      projectId,
      key: "NEW",
    });

    expect(await storyOf(taskId)).toEqual(before);
    const [row] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, taskId));
    expect(row?.completedAt).toBeInstanceOf(Date);
    expect(row?.labelIds).toEqual([]);
  });

  it("writes nothing when a removed member's assignments are cleared", async () => {
    const { client, workspace, target, taskId } = await setup();
    const leaver = await addWorkspaceMember(workspace.id, "member");
    await client.tasks.updateAssignee({ ...target, assigneeId: leaver.id });
    const before = await storyOf(taskId);

    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, leaver.id));

    expect(await storyOf(taskId)).toEqual(before);
    const [row] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, taskId));
    expect(row?.assigneeId).toBeNull();
  });
});

describe("folding repeated edits", () => {
  it("folds the same person's same-field edits into one, keeping the first from", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateTitle({ ...target, title: "Ren" });
    await client.tasks.updateTitle({ ...target, title: "Rena" });
    await client.tasks.updateTitle({ ...target, title: "Renamed" });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      { type: "title", data: { from: "Original", to: "Renamed" } },
    ]);
  });

  it("folds the same person's start date edits into one", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateStartDate({ ...target, startDate: "2026-12-01" });
    await client.tasks.updateStartDate({ ...target, startDate: "2026-12-02" });
    await client.tasks.updateStartDate({
      ...target,
      startDate: "2026-12-03T10:00:00Z",
    });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      {
        type: "start_date",
        data: { from: null, to: "2026-12-03T10:00:00.000Z" },
      },
    ]);
  });

  it("drops the entry when the edit is undone within the window", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updatePriority({ ...target, priority: "high" });
    await client.tasks.updatePriority({ ...target, priority: "none" });

    expect((await storyOf(taskId)).map((event) => event.type)).toEqual([
      "created",
    ]);
  });

  it("drops a label that was added and removed again", async () => {
    const { client, target, taskId, addLabel } = await setup();
    const bug = await addLabel("Bug");

    await client.tasks.addLabel({ ...target, labelId: bug.id });
    await client.tasks.removeLabel({ ...target, labelId: bug.id });

    expect((await storyOf(taskId)).map((event) => event.type)).toEqual([
      "created",
    ]);
  });

  it("leaves one entry for a burst of description autosaves", async () => {
    const { client, target, taskId } = await setup();

    for (const text of ["a", "ab", "abc", "abcd"]) {
      await client.tasks.updateDescription({ ...target, description: text });
    }

    expect(
      (await storyOf(taskId)).filter((event) => event.type === "description"),
    ).toHaveLength(1);
  });

  it("adds an entry for another person, another field, or an edit after the window", async () => {
    const { client, workspace, target, taskId } = await setup();
    const colleague = as(await addWorkspaceMember(workspace.id, "member"));

    await client.tasks.updateTitle({ ...target, title: "One" });
    await colleague.tasks.updateTitle({ ...target, title: "Two" });
    await colleague.tasks.updatePriority({ ...target, priority: "low" });
    await ageEvents(taskId, 11);
    await colleague.tasks.updatePriority({ ...target, priority: "high" });

    expect((await storyOf(taskId)).slice(1)).toEqual([
      { type: "title", data: { from: "Original", to: "One" } },
      { type: "title", data: { from: "One", to: "Two" } },
      { type: "priority", data: { from: "none", to: "low" } },
      { type: "priority", data: { from: "low", to: "high" } },
    ]);
  });

  it("does not fold into an older entry once another field intervened", async () => {
    const { client, target, taskId } = await setup();

    await client.tasks.updateTitle({ ...target, title: "One" });
    await client.tasks.updatePriority({ ...target, priority: "low" });
    await client.tasks.updateTitle({ ...target, title: "Two" });

    expect((await storyOf(taskId)).map((event) => event.type)).toEqual([
      "created",
      "title",
      "priority",
      "title",
    ]);
  });
});
