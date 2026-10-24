import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { addField } from "./helpers/fields";
import { eventsOf, storyOf } from "./helpers/history";
import { newCommentId } from "./helpers/comments";
import { newLinkId } from "./helpers/links";
import { as, columnsOf, rejection } from "./helpers/projects";
import { newTaskId, setupTasks, taskRow, xminOfTask } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks("MOR");
  const { client, workspace } = context;
  const web = await client.projects.create({
    workspaceId: workspace.id,
    name: "Website",
    key: "WEB",
  });
  const webColumns = await columnsOf(web.id);
  const webColumn = (name: string) => {
    const column = webColumns.find((candidate) => candidate.name === name);
    if (!column) throw new Error(`No column ${name}`);
    return column;
  };
  const toWeb = (
    taskIds: string[],
    options: { columnId?: string; withSubtasks?: boolean } = {},
    asClient = client,
  ) =>
    asClient.tasks.moveToProject({
      workspaceId: workspace.id,
      taskIds,
      toProjectId: web.id,
      ...options,
    });
  const toMor = (taskIds: string[], options: { columnId?: string } = {}) =>
    client.tasks.moveToProject({
      workspaceId: workspace.id,
      taskIds,
      toProjectId: context.projectId,
      ...options,
    });
  const ticket = (projectId: string, ticketId: string) =>
    client.tasks.get({ workspaceId: workspace.id, projectId, ticketId });
  return { ...context, web, webColumn, webColumns, toWeb, toMor, ticket };
}

async function aliasRows(taskId: string) {
  const rows = await db
    .select()
    .from(schema.taskTicketAliasTable)
    .where(eq(schema.taskTicketAliasTable.taskId, taskId));
  return rows.map((row) => `${row.projectId}:${row.number}`).sort();
}

describe("numbering and the old Ticket id", () => {
  it("gives the next number of the destination and keeps the old id resolving", async () => {
    const { addTask, toWeb, ticket, web, projectId, webColumn } = await setup();
    await addTask();
    const task = await addTask("In Progress", { title: "Wrong board" });

    const { moved, txid } = await toWeb([task.id]);

    expect(moved).toMatchObject([
      {
        taskId: task.id,
        fromTicketId: "MOR-2",
        toTicketId: "WEB-1",
        column: "In Progress",
        droppedValues: [],
        detachedFrom: null,
      },
    ]);
    expect(txid).toBe(await xminOfTask(task.id));
    const row = await taskRow(task.id);
    expect(row).toMatchObject({
      projectId: web.id,
      number: 1,
      columnId: webColumn("In Progress").id,
    });
    expect(await aliasRows(task.id)).toEqual([`${projectId}:2`]);

    const viaOld = await ticket(projectId, "MOR-2");
    expect(viaOld).toMatchObject({
      id: task.id,
      ticketId: "WEB-1",
      projectId: web.id,
      title: "Wrong board",
    });
    expect((await ticket(web.id, "WEB-1")).id).toBe(task.id);
  });

  it("resolves a ticket without loading the task", async () => {
    const { client, base, addTask, toWeb, web } = await setup();
    const task = await addTask();
    await toWeb([task.id]);

    const resolved = await client.tasks.resolveTicket({
      ...base,
      ticketId: "MOR-1",
    });

    expect(resolved).toEqual({
      id: task.id,
      projectId: web.id,
      ticketId: "WEB-1",
    });
  });

  it("gives the old number back when the task returns, and never reuses numbers", async () => {
    const { addTask, toWeb, toMor, ticket, web } = await setup();
    const first = await addTask();
    const second = await addTask();
    await toWeb([first.id]);
    const created = await addTask();
    expect(created.number).toBe(3);

    const { moved } = await toMor([first.id]);

    expect(moved[0]).toMatchObject({
      fromTicketId: "WEB-1",
      toTicketId: "MOR-1",
    });
    expect((await taskRow(first.id))?.number).toBe(1);
    // The alias for MOR-1 is gone; the one for WEB-1 now points back.
    expect(await aliasRows(first.id)).toEqual([`${web.id}:1`]);
    expect((await ticket(web.id, "WEB-1")).ticketId).toBe("MOR-1");
    const next = await addTask();
    expect(next.number).toBe(4);
    expect((await taskRow(second.id))?.number).toBe(2);
  });

  it("keeps the old id working after the destination's key is renamed", async () => {
    const { client, base, addTask, toWeb, web, ticket, projectId } =
      await setup();
    const task = await addTask();
    await toWeb([task.id]);

    await client.projects.changeKey({
      ...base,
      projectId: web.id,
      key: "SITE",
    });

    expect((await ticket(projectId, "MOR-1")).ticketId).toBe("SITE-1");
  });

  it("takes the next numbers parent first, depth first", async () => {
    const { addTask, toWeb } = await setup();
    const solo = await addTask("To Do", { title: "solo" });
    const parent = await addTask("To Do", { title: "parent" });
    const second = await addTask("To Do", {
      title: "second child",
      parentId: parent.id,
    });
    const first = await addTask("To Do", {
      title: "first child",
      parentId: parent.id,
    });
    const grandchild = await addTask("To Do", {
      title: "grandchild",
      parentId: second.id,
    });

    await toWeb([solo.id, parent.id]);

    const numbers = async (...ids: string[]) =>
      Promise.all(ids.map(async (id) => (await taskRow(id))?.number));
    // Roots by their old number (solo 1, parent 2), children by theirs.
    expect(
      await numbers(solo.id, parent.id, second.id, grandchild.id, first.id),
    ).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("Columns", () => {
  it("lands in the Column with the same name and category", async () => {
    const { addTask, toWeb, webColumn } = await setup();
    const task = await addTask("In Progress");

    await toWeb([task.id]);

    expect((await taskRow(task.id))?.columnId).toBe(
      webColumn("In Progress").id,
    );
  });

  it("falls back to the first Column of its category, then to the first unstarted one", async () => {
    const { client, base, web, addTask, toWeb, webColumn } = await setup();
    await client.projects.columns.update({
      workspaceId: base.workspaceId,
      projectId: web.id,
      columnId: webColumn("In Progress").id,
      name: "Doing",
    });
    await client.projects.columns.remove({
      workspaceId: base.workspaceId,
      projectId: web.id,
      columnId: webColumn("Backlog").id,
      targetColumnId: webColumn("To Do").id,
    });
    const started = await addTask("In Progress");
    const backlog = await addTask("Backlog");
    const canceled = await addTask("Canceled");

    await toWeb([started.id, backlog.id, canceled.id]);

    const after = await columnsOf(web.id);
    const idOf = (name: string) => after.find((c) => c.name === name)?.id;
    expect(after.map((column) => column.name)).not.toContain("Backlog");
    expect((await taskRow(started.id))?.columnId).toBe(idOf("Doing"));
    expect((await taskRow(backlog.id))?.columnId).toBe(idOf("To Do"));
    expect((await taskRow(canceled.id))?.columnId).toBe(idOf("Canceled"));
  });

  it("puts the selected Tasks in the Column the caller picked, and each Subtask by its own state", async () => {
    const { addTask, toWeb, webColumn } = await setup();
    const parent = await addTask("To Do");
    const done = await addTask("Done", { parentId: parent.id });

    await toWeb([parent.id], { columnId: webColumn("Backlog").id });

    expect((await taskRow(parent.id))?.columnId).toBe(webColumn("Backlog").id);
    expect((await taskRow(done.id))?.columnId).toBe(webColumn("Done").id);
  });

  it("applies one picked Column to every selected Task in a bulk move", async () => {
    const { addTask, toWeb, webColumn } = await setup();
    const a = await addTask("To Do");
    const b = await addTask("Done");

    await toWeb([a.id, b.id], { columnId: webColumn("Backlog").id });

    for (const id of [a.id, b.id]) {
      expect((await taskRow(id))?.columnId).toBe(webColumn("Backlog").id);
    }
  });

  it("refuses a Column of another Project, changing nothing", async () => {
    const { addTask, toWeb, byName, projectId } = await setup();
    const task = await addTask();

    const refused = await rejection(
      toWeb([task.id], { columnId: byName("Done").id }),
    );

    expect(refused.data?.code).toBe("COLUMN_NOT_IN_PROJECT");
    expect((await taskRow(task.id))?.projectId).toBe(projectId);
  });

  it("appends after the Column's last Task, archived ones included, in the order the Tasks had", async () => {
    const { client, base, addTask, toWeb, webColumn, web } = await setup();
    const existing = await client.tasks.create({
      workspaceId: base.workspaceId,
      projectId: web.id,
      id: newTaskId(),
      columnId: webColumn("To Do").id,
      position: "a0",
      title: "Already there",
    });
    void existing;
    const hidden = newTaskId();
    await client.tasks.create({
      workspaceId: base.workspaceId,
      projectId: web.id,
      id: hidden,
      columnId: webColumn("To Do").id,
      position: "a5",
      title: "Archived",
    });
    await client.tasks.archive({
      workspaceId: base.workspaceId,
      projectId: web.id,
      taskId: hidden,
    });
    const first = await addTask("To Do");
    const second = await addTask("To Do");
    const third = await addTask("To Do");

    await toWeb([third.id, first.id, second.id]);

    const positions = await Promise.all(
      [first.id, second.id, third.id].map(
        async (id) => (await taskRow(id))?.position,
      ),
    );
    expect(positions.every((p) => p! > "a5")).toBe(true);
    expect([...positions].sort()).toEqual(positions);
  });
});

describe("completion and archive", () => {
  it("keeps a completed Task completed in a closed Column and reopens it in an open one", async () => {
    const { addTask, toWeb, webColumn } = await setup();
    const done = await addTask("Done");
    const before = (await taskRow(done.id))?.completedAt;
    expect(before).toBeTruthy();
    const reopened = await addTask("Done");
    const open = await addTask("To Do");

    await toWeb([done.id]);
    await toWeb([reopened.id], { columnId: webColumn("To Do").id });
    await toWeb([open.id], { columnId: webColumn("Done").id });

    expect((await taskRow(done.id))?.completedAt).toEqual(before);
    expect((await taskRow(reopened.id))?.completedAt).toBeNull();
    expect((await taskRow(open.id))?.completedAt).toBeTruthy();
  });

  it("keeps an archived Task archived", async () => {
    const { client, base, addTask, toWeb } = await setup();
    const task = await addTask();
    await client.tasks.archive({ ...base, taskId: task.id });

    await toWeb([task.id]);

    expect((await taskRow(task.id))?.archivedAt).toBeTruthy();
  });

  it("refreshes what a moved blocker blocks when its state changes", async () => {
    const { client, workspace, addTask, toWeb, webColumn } = await setup();
    const blocker = await addTask("To Do");
    const blocked = await addTask("To Do");
    await client.relations.add({
      workspaceId: workspace.id,
      id: newTaskId(),
      type: "blocks",
      sourceTaskId: blocker.id,
      targetTaskId: blocked.id,
    });
    expect((await taskRow(blocked.id))?.openBlockerCount).toBe(1);

    await toWeb([blocker.id], { columnId: webColumn("Done").id });

    expect((await taskRow(blocked.id))?.openBlockerCount).toBe(0);
  });
});

describe("Field values", () => {
  it("rewrites matched values to the destination's ids and drops, by name, what has no match", async () => {
    const context = await setup();
    const { client, base, web, addTask, toWeb } = context;
    const size = await addField(context, "Size", ["L", "XL"]);
    const areas = await addField(context, "Areas", ["API", "Web"], {
      type: "multi_choice",
    });
    const points = await addField(context, "Points", [], { type: "number" });
    const note = await addField(context, "Note", [], { type: "text" });
    const webBase = { workspaceId: base.workspaceId, projectId: web.id };
    const webSize = await addField({ client, base: webBase }, "size", ["l"]);
    const webAreas = await addField(
      { client, base: webBase },
      "Areas",
      ["web"],
      { type: "multi_choice" },
    );
    // Same name, other type.
    await addField({ client, base: webBase }, "Points", [], { type: "text" });
    const task = await addTask("To Do");
    const set = (fieldId: string, value: unknown) =>
      client.tasks.setFieldValue({
        ...base,
        taskId: task.id,
        fieldId,
        value: value as string,
      });
    await set(size.id, size.options.L);
    await set(areas.id, [areas.options.API, areas.options.Web]);
    await set(points.id, 5);
    await set(note.id, "hello");

    const { moved } = await toWeb([task.id]);

    expect((await taskRow(task.id))?.fieldValues).toEqual({
      [webSize.id]: webSize.options.l,
      [webAreas.id]: [webAreas.options.web],
    });
    expect(moved[0]?.droppedValues).toEqual(
      expect.arrayContaining([
        { field: "Areas", value: ["API"] },
        { field: "Points", value: 5 },
        { field: "Note", value: "hello" },
      ]),
    );
    expect(moved[0]?.droppedValues).toHaveLength(3);
  });

  it("drops an unmatched choice option", async () => {
    const context = await setup();
    const { client, base, web, addTask, toWeb } = context;
    const size = await addField(context, "Size", ["XL"]);
    await addField(
      { client, base: { workspaceId: base.workspaceId, projectId: web.id } },
      "Size",
      ["S"],
    );
    const task = await addTask("To Do", {
      fieldValues: { [size.id]: size.options.XL! },
    });

    const { moved } = await toWeb([task.id]);

    expect((await taskRow(task.id))?.fieldValues).toEqual({});
    expect(moved[0]?.droppedValues).toEqual([{ field: "Size", value: "XL" }]);
  });
});

describe("Subtasks", () => {
  it("moves the whole subtree by default and keeps each counter right", async () => {
    const { addTask, toWeb, web } = await setup();
    const parent = await addTask("To Do");
    const child = await addTask("Done", { parentId: parent.id });
    const grandchild = await addTask("To Do", { parentId: child.id });

    const { moved } = await toWeb([parent.id]);

    expect(moved.map((task) => task.toTicketId)).toEqual([
      "WEB-1",
      "WEB-2",
      "WEB-3",
    ]);
    for (const id of [parent.id, child.id, grandchild.id]) {
      expect((await taskRow(id))?.projectId).toBe(web.id);
    }
    expect((await taskRow(child.id))?.parentId).toBe(parent.id);
    expect(await taskRow(parent.id)).toMatchObject({
      subtaskDone: 1,
      subtaskTotal: 1,
    });
  });

  it("leaves the Subtasks behind as top-level Tasks when asked", async () => {
    const { addTask, toWeb, projectId, web } = await setup();
    const parent = await addTask("To Do");
    const child = await addTask("To Do", { parentId: parent.id });

    const { moved } = await toWeb([parent.id], { withSubtasks: false });

    expect(moved).toHaveLength(1);
    expect(await taskRow(child.id)).toMatchObject({
      projectId,
      parentId: null,
    });
    expect(await taskRow(parent.id)).toMatchObject({
      projectId: web.id,
      subtaskTotal: 0,
    });
    expect(await storyOf(child.id)).toMatchObject([
      { type: "created" },
      { type: "parent", data: { from: null, to: "MOR-1" } },
      { type: "parent", data: { from: "MOR-1", to: null } },
    ]);
    expect(await storyOf(parent.id)).toMatchObject([
      { type: "created" },
      { type: "subtask_added", data: { ticketId: "MOR-2" } },
      { type: "subtask_removed", data: { ticketId: "MOR-2" } },
      { type: "project_moved" },
    ]);
  });

  it("makes a Subtask moved on its own leave its Parent", async () => {
    const { addTask, toWeb, web } = await setup();
    const parent = await addTask("To Do");
    const kept = await addTask("Done", { parentId: parent.id });
    const child = await addTask("To Do", { parentId: parent.id });
    expect(await taskRow(parent.id)).toMatchObject({
      subtaskDone: 1,
      subtaskTotal: 2,
    });

    const { moved } = await toWeb([child.id]);

    expect(moved[0]?.detachedFrom).toBe("MOR-1");
    expect(await taskRow(child.id)).toMatchObject({
      projectId: web.id,
      parentId: null,
    });
    expect(await taskRow(parent.id)).toMatchObject({
      subtaskDone: 1,
      subtaskTotal: 1,
    });
    expect((await storyOf(parent.id)).at(-1)).toEqual({
      type: "subtask_removed",
      data: { ticketId: "MOR-3" },
    });
    expect(await storyOf(child.id)).toMatchObject([
      { type: "created" },
      { type: "parent", data: { from: null, to: "MOR-1" } },
      { type: "parent", data: { from: "MOR-1", to: null } },
      { type: "project_moved" },
    ]);
    expect(await taskRow(kept.id)).toMatchObject({ parentId: parent.id });
  });

  it("moves a selected Parent and Subtask together once", async () => {
    const { addTask, toWeb } = await setup();
    const parent = await addTask("To Do");
    const child = await addTask("To Do", { parentId: parent.id });

    const { moved } = await toWeb([child.id, parent.id]);

    expect(moved.map((task) => task.taskId)).toEqual([parent.id, child.id]);
    expect((await taskRow(child.id))?.parentId).toBe(parent.id);
  });

  it("keeps a selected Subtask under a moving Parent when Subtasks are not moved along", async () => {
    const { addTask, toWeb } = await setup();
    const parent = await addTask("To Do");
    const child = await addTask("To Do", { parentId: parent.id });
    const other = await addTask("To Do", { parentId: parent.id });

    await toWeb([parent.id, child.id], { withSubtasks: false });

    expect((await taskRow(child.id))?.parentId).toBe(parent.id);
    expect((await taskRow(other.id))?.parentId).toBeNull();
    expect(await taskRow(parent.id)).toMatchObject({ subtaskTotal: 1 });
  });
});

describe("what stays with the Task", () => {
  it("moves the description, comments, links and history, and keeps relations, labels and assignee", async () => {
    const { client, base, workspace, owner, addTask, toWeb, web, projectId } =
      await setup();
    const task = await addTask("To Do", {
      description: "Body",
      assigneeId: owner.id,
    });
    const other = await addTask("To Do");
    const label = await client.labels.create({
      workspaceId: workspace.id,
      id: newTaskId(),
      name: "bug",
      color: "#ef4444",
      position: "a0",
    });
    await client.tasks.addLabel({
      ...base,
      taskId: task.id,
      labelId: label.id,
    });
    await client.comments.create({
      ...base,
      taskId: task.id,
      id: newCommentId(),
      body: "hello",
    });
    await client.links.add({
      ...base,
      taskId: task.id,
      id: newLinkId(),
      url: "https://example.com",
    });
    await client.relations.add({
      workspaceId: workspace.id,
      id: newTaskId(),
      type: "related",
      sourceTaskId: task.id,
      targetTaskId: other.id,
    });

    await toWeb([task.id]);

    const under = async (
      table:
        | typeof schema.taskDescriptionTable
        | typeof schema.taskCommentTable
        | typeof schema.taskLinkTable
        | typeof schema.taskEventTable,
    ) =>
      (await db.select().from(table).where(eq(table.taskId, task.id))).map(
        (row) => row.projectId,
      );
    for (const table of [
      schema.taskDescriptionTable,
      schema.taskCommentTable,
      schema.taskLinkTable,
      schema.taskEventTable,
    ]) {
      const projects = await under(table);
      expect(projects.length).toBeGreaterThan(0);
      expect(new Set(projects)).toEqual(new Set([web.id]));
    }
    expect(await taskRow(task.id)).toMatchObject({
      assigneeId: owner.id,
      labelIds: [label.id],
    });
    const detail = await client.tasks.get({
      workspaceId: workspace.id,
      projectId: web.id,
      ticketId: "WEB-1",
    });
    expect(detail.relations.map((relation) => relation.ticketId)).toEqual([
      "MOR-2",
    ]);
    expect(detail.comments.map((comment) => comment.body)).toEqual(["hello"]);
    expect(detail.links).toHaveLength(1);
    expect(detail.description).toBe("Body");
    // The other end of the relation sees the new id.
    const seen = await client.tasks.get({
      workspaceId: workspace.id,
      projectId,
      ticketId: "MOR-2",
    });
    expect(seen.relations.map((relation) => relation.ticketId)).toEqual([
      "WEB-1",
    ]);
  });
});

describe("history and activity", () => {
  it("writes project_moved to every moved Task, and task.moved to the feed", async () => {
    const { addTask, toWeb, web, projectId, workspace } = await setup();
    const parent = await addTask("In Progress", { title: "Epic" });
    const child = await addTask("To Do", { parentId: parent.id });

    await toWeb([parent.id]);

    const moved = async (id: string) =>
      (await eventsOf(id)).filter((event) => event.type === "project_moved");
    const [parentEvent] = await moved(parent.id);
    expect(parentEvent?.projectId).toBe(web.id);
    expect(parentEvent?.data).toMatchObject({
      from: {
        projectId,
        key: "MOR",
        name: "Project MOR",
        ticketId: "MOR-1",
        column: { name: "In Progress", category: "started" },
      },
      to: {
        projectId: web.id,
        key: "WEB",
        name: "Website",
        ticketId: "WEB-1",
        column: { name: "In Progress", category: "started" },
      },
      droppedValues: [],
    });
    expect(await moved(child.id)).toHaveLength(1);

    const feed = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.workspaceId, workspace.id));
    const entries = feed.filter((row) => row.type === "task.moved");
    expect(entries.map((row) => row.eventData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticketId: "WEB-1",
          fromTicketId: "MOR-1",
          taskTitle: "Epic",
          fromProjectName: "Project MOR",
          toProjectName: "Website",
          projectId: web.id,
        }),
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it("does not fold two moves into one entry", async () => {
    const { addTask, toWeb, toMor } = await setup();
    const task = await addTask();

    await toWeb([task.id]);
    await toMor([task.id]);

    expect(
      (await eventsOf(task.id)).filter(
        (event) => event.type === "project_moved",
      ),
    ).toHaveLength(2);
  });
});

describe("refusals", () => {
  it("refuses a Viewer and changes nothing", async () => {
    const { workspace, addTask, toWeb, client, projectId } = await setup();
    const viewer = await addWorkspaceMember(workspace.id, "viewer");
    const task = await addTask();

    const refused = await rejection(toWeb([task.id], {}, as(viewer)));

    expect(refused.code).toBe("FORBIDDEN");
    expect((await taskRow(task.id))?.projectId).toBe(projectId);
    void client;
  });

  it("refuses an archived source or destination Project", async () => {
    const { client, workspace, addTask, toWeb, web, projectId } = await setup();
    const task = await addTask();
    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: web.id,
    });

    const intoArchived = await rejection(toWeb([task.id]));

    expect(intoArchived.data?.code).toBe("PROJECT_ARCHIVED");

    await client.projects.unarchive({
      workspaceId: workspace.id,
      projectId: web.id,
    });
    await client.projects.archive({ workspaceId: workspace.id, projectId });
    const outOfArchived = await rejection(toWeb([task.id]));

    expect(outOfArchived.data?.code).toBe("PROJECT_ARCHIVED");
  });

  it("refuses a Project of another Workspace and a Task of another Workspace", async () => {
    const { addTask, workspace, client, projectId } = await setup();
    const foreign = await setup();
    const task = await addTask();

    const toForeign = await rejection(
      client.tasks.moveToProject({
        workspaceId: workspace.id,
        taskIds: [task.id],
        toProjectId: foreign.web.id,
      }),
    );
    const foreignTask = await rejection(
      client.tasks.moveToProject({
        workspaceId: workspace.id,
        taskIds: [(await foreign.addTask()).id],
        toProjectId: projectId,
      }),
    );

    expect(toForeign.code).toBe("NOT_FOUND");
    expect(foreignTask.code).toBe("NOT_FOUND");
    expect((await taskRow(task.id))?.projectId).toBe(projectId);
  });

  it("refuses a Task already in the destination", async () => {
    const { addTask, toWeb, toMor } = await setup();
    const task = await addTask();
    await toWeb([task.id]);

    const refused = await rejection(toWeb([task.id]));

    expect(refused.data?.code).toBe("MOVE_SAME_PROJECT");
    expect(toMor).toBeDefined();
  });

  it("refuses more than 500 Tasks with the count, writing nothing", async () => {
    const { addTask, toWeb, byName, projectId } = await setup();
    const parent = await addTask();
    await db.execute(
      sql`INSERT INTO task (id, project_id, column_id, parent_id, number, title, position)
        SELECT 'bulk' || n, ${projectId}, ${byName("To Do").id}, ${parent.id}, 100 + n, 'bulk', 'b' || lpad(n::text, 4, '0')
        FROM generate_series(1, 500) AS n`,
    );

    const refused = await rejection(toWeb([parent.id]));

    expect(refused.data).toMatchObject({ code: "MOVE_TOO_LARGE", count: 501 });
    expect((await taskRow(parent.id))?.projectId).toBe(projectId);
    const stayed = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.title, "bulk"));
    expect(stayed).toHaveLength(500);
    expect(stayed.every((row) => row.projectId === projectId)).toBe(true);
    expect(await db.select().from(schema.taskTicketAliasTable)).toEqual([]);
    // Without its Subtasks the Parent alone is fine.
    await toWeb([parent.id], { withSubtasks: false });
  });
});

describe("several source Projects and concurrency", () => {
  it("moves Tasks from several Projects in one call", async () => {
    const { client, workspace, addTask, toWeb } = await setup();
    const third = await client.projects.create({
      workspaceId: workspace.id,
      name: "Third",
      key: "THR",
    });
    const thirdColumns = await columnsOf(third.id);
    const elsewhere = newTaskId();
    await client.tasks.create({
      workspaceId: workspace.id,
      projectId: third.id,
      id: elsewhere,
      columnId: thirdColumns.find((column) => column.name === "To Do")!.id,
      position: "a0",
      title: "Elsewhere",
    });
    const here = await addTask();

    const { moved } = await toWeb([here.id, elsewhere]);

    expect(moved.map((task) => task.fromTicketId).sort()).toEqual([
      "MOR-1",
      "THR-1",
    ]);
    expect(moved.map((task) => task.toTicketId).sort()).toEqual([
      "WEB-1",
      "WEB-2",
    ]);
  });

  it("ends a race between two moves of the same Task with it in one Project and a consistent alias", async () => {
    const { client, workspace, addTask, web, projectId } = await setup();
    const third = await client.projects.create({
      workspaceId: workspace.id,
      name: "Third",
      key: "THR",
    });
    const task = await addTask();
    const to = (toProjectId: string) =>
      client.tasks.moveToProject({
        workspaceId: workspace.id,
        taskIds: [task.id],
        toProjectId,
      });

    const results = await Promise.allSettled([to(web.id), to(third.id)]);

    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const row = await taskRow(task.id);
    expect([web.id, third.id]).toContain(row?.projectId);
    const moves = (await eventsOf(task.id)).filter(
      (event) => event.type === "project_moved",
    );
    expect(moves).toHaveLength(
      results.filter((result) => result.status === "fulfilled").length,
    );
    // Every old id resolves to the one Task, at its current id.
    const rows = await db
      .select()
      .from(schema.taskTicketAliasTable)
      .where(eq(schema.taskTicketAliasTable.taskId, task.id));
    expect(rows.length).toBe(moves.length);
    expect(rows.every((alias) => alias.projectId !== row?.projectId)).toBe(
      true,
    );
    const home = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, row!.projectId));
    const resolved = await client.tasks.get({
      workspaceId: workspace.id,
      projectId,
      ticketId: "MOR-1",
    });
    expect(resolved.ticketId).toBe(`${home[0]!.key}-${row!.number}`);
  });
});
