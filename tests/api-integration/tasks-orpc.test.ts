import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { as, columnsOf, createProject, rejection } from "./helpers/projects";
import {
  newTaskId,
  positionAt,
  setupTasks,
  taskRow,
  xminOfTask,
} from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

describe("creating a task", () => {
  it("takes the next ticket number of the project and returns the txid", async () => {
    const { addTask } = await setupTasks();

    const first = await addTask();
    const second = await addTask();

    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first.txid).toBe(await xminOfTask(first.id));
  });

  it("never reuses a number, not even of a deleted task", async () => {
    const { client, base, addTask } = await setupTasks();
    const first = await addTask();
    await client.tasks.remove({ ...base, taskId: first.id });

    const next = await addTask();

    expect(next.number).toBe(2);
  });

  it("numbers each project on its own", async () => {
    const { client, workspace, addTask } = await setupTasks();
    const other = await createProject(client, workspace.id, "OTH");
    const [column] = await columnsOf(other.id);
    await addTask();

    const created = await client.tasks.create({
      workspaceId: workspace.id,
      projectId: other.id,
      id: newTaskId(),
      columnId: column!.id,
      position: positionAt(0),
      title: "Elsewhere",
    });

    expect(created.number).toBe(1);
  });

  it("stores what the client chose and defaults the rest", async () => {
    const { owner, byName, addTask } = await setupTasks();

    const { id } = await addTask("In Progress", {
      title: "  Ship it  ",
      description: "## Plan",
      priority: "high",
      dueDate: "2026-12-31",
    });

    expect(await taskRow(id)).toMatchObject({
      columnId: byName("In Progress").id,
      title: "Ship it",
      description: "## Plan",
      priority: "high",
      dueDate: "2026-12-31",
      assigneeId: null,
      completedAt: null,
      archivedAt: null,
      createdBy: owner.id,
    });
  });

  it("starts a task created in a done column as completed", async () => {
    const { addTask } = await setupTasks();

    const { id } = await addTask("Done");

    expect((await taskRow(id))?.completedAt).toBeInstanceOf(Date);
  });

  it("refuses a malformed id, a taken id and a bad position", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const existing = await addTask();
    const column = byName("To Do");
    const create = (input: Record<string, unknown>) =>
      client.tasks.create({
        ...base,
        id: newTaskId(),
        columnId: column.id,
        position: positionAt(5),
        title: "x",
        ...input,
      });

    const malformed = await rejection(create({ id: "not-a-cuid" }));
    const idTaken = await rejection(create({ id: existing.id }));
    const badPosition = await rejection(create({ position: "not a key" }));

    expect(malformed.data?.code).toBe("INVALID_ID");
    expect(idTaken.data?.code).toBe("ID_TAKEN");
    expect(badPosition.data?.code).toBe("INVALID_POSITION");
  });

  it("puts a task right after whatever already holds its position", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const column = byName("To Do");
    const first = await addTask();
    const second = await addTask();
    // An archived task keeps its slot and the browser does not see it.
    await client.tasks.archive({ ...base, taskId: second.id });

    const created = await addTask("To Do", { position: positionAt(1) });
    const clash = await addTask("To Do", { position: positionAt(0) });

    const positions = await Promise.all(
      [first, second, created, clash].map(
        async (task) => (await taskRow(task.id))!.position,
      ),
    );
    expect(positions[2]! > positions[1]!).toBe(true);
    expect(positions[3]! > positions[0]!).toBe(true);
    expect(positions[3]! < positions[1]!).toBe(true);
    expect(new Set(positions).size).toBe(4);
    expect(column.id).toBe((await taskRow(created.id))?.columnId);
  });

  it("does not spend a ticket number on a refused create", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    await addTask();
    await rejection(
      client.tasks.create({
        ...base,
        id: newTaskId(),
        columnId: byName("To Do").id,
        position: "not a key",
        title: "x",
      }),
    );

    expect((await addTask()).number).toBe(2);
  });

  it("refuses a column of another project", async () => {
    const { client, base, workspace } = await setupTasks();
    const other = await createProject(client, workspace.id, "OTH");
    const [foreign] = await columnsOf(other.id);

    const error = await rejection(
      client.tasks.create({
        ...base,
        id: newTaskId(),
        columnId: foreign!.id,
        position: positionAt(0),
        title: "x",
      }),
    );

    expect(error.data?.code).toBe("COLUMN_NOT_IN_PROJECT");
  });
});

describe("field rules", () => {
  it("limits title and description and checks priority and due date", async () => {
    const { client, base, byName } = await setupTasks();
    const column = byName("To Do");
    const create = (input: Record<string, unknown>) =>
      client.tasks.create({
        ...base,
        id: newTaskId(),
        columnId: column.id,
        position: positionAt(9),
        title: "ok",
        ...input,
      });

    for (const input of [
      { title: "   " },
      { title: "x".repeat(501) },
      { description: "x".repeat(100_001) },
      { priority: "critical" },
      { dueDate: "2026-02-30" },
      { dueDate: "2026-12-31T00:00:00Z" },
    ]) {
      expect((await rejection(create(input))).code).toBe("BAD_REQUEST");
    }
    await create({ title: "x".repeat(500), description: "x".repeat(100_000) });
  });

  it("keeps a due date as a calendar day whatever the server's zone", async () => {
    const { client, base, addTask } = await setupTasks();
    const { id } = await addTask("To Do", { dueDate: "2026-03-08" });

    await client.tasks.updateDueDate({
      ...base,
      taskId: id,
      dueDate: "2026-11-01",
    });
    const rows = await db.execute<{ due: string }>(
      sql`SELECT due_date::text AS due FROM task WHERE id = ${id}`,
    );

    expect(rows.rows[0]?.due).toBe("2026-11-01");
    await client.tasks.updateDueDate({ ...base, taskId: id, dueDate: null });
    expect((await taskRow(id))?.dueDate).toBeNull();
  });

  it("writes only the field group it was asked to", async () => {
    const { client, base, addTask } = await setupTasks();
    const { id } = await addTask("To Do", { title: "Before", priority: "low" });

    await client.tasks.updateDescription({
      ...base,
      taskId: id,
      description: "Notes",
    });
    await client.tasks.updatePriority({
      ...base,
      taskId: id,
      priority: "urgent",
    });
    const { txid } = await client.tasks.updateTitle({
      ...base,
      taskId: id,
      title: "After",
    });

    expect(await taskRow(id)).toMatchObject({
      title: "After",
      description: "Notes",
      priority: "urgent",
    });
    expect(txid).toBe(await xminOfTask(id));
  });

  it("treats a task of another project as not found", async () => {
    const { client, base, workspace, addTask } = await setupTasks();
    const { id } = await addTask();
    const other = await createProject(client, workspace.id, "OTH");

    const error = await rejection(
      client.tasks.updateTitle({
        workspaceId: workspace.id,
        projectId: other.id,
        taskId: id,
        title: "Hijacked",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect((await taskRow(id))?.title).not.toBe("Hijacked");
    expect(base.projectId).not.toBe(other.id);
  });
});

describe("assigning", () => {
  it("lets a member take a task and let it go, but not hand it to others", async () => {
    const { workspace, base, addTask } = await setupTasks();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const asMember = as(member);
    const { id } = await addTask();

    await asMember.tasks.updateAssignee({
      ...base,
      taskId: id,
      assigneeId: member.id,
    });
    expect((await taskRow(id))?.assigneeId).toBe(member.id);

    const error = await rejection(
      asMember.tasks.updateAssignee({
        ...base,
        taskId: id,
        assigneeId: colleague.id,
      }),
    );
    expect(error.data?.code).toBe("FORBIDDEN_ASSIGN");

    await asMember.tasks.updateAssignee({
      ...base,
      taskId: id,
      assigneeId: null,
    });
    expect((await taskRow(id))?.assigneeId).toBeNull();
  });

  it("does not let a member unassign someone else", async () => {
    const { client, workspace, base, addTask } = await setupTasks();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const { id } = await addTask();
    await client.tasks.updateAssignee({
      ...base,
      taskId: id,
      assigneeId: colleague.id,
    });

    const error = await rejection(
      as(member).tasks.updateAssignee({
        ...base,
        taskId: id,
        assigneeId: null,
      }),
    );

    expect(error.data?.code).toBe("FORBIDDEN_ASSIGN");
  });

  it("lets an admin assign any current member, and only members", async () => {
    const { client, workspace, base, addTask } = await setupTasks();
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const outsider = await addWorkspaceMember(
      (await setupTasks("OUT")).workspace.id,
    );
    const { id } = await addTask();

    await client.tasks.updateAssignee({
      ...base,
      taskId: id,
      assigneeId: colleague.id,
    });
    const error = await rejection(
      client.tasks.updateAssignee({
        ...base,
        taskId: id,
        assigneeId: outsider.id,
      }),
    );

    expect((await taskRow(id))?.assigneeId).toBe(colleague.id);
    expect(error.data?.code).toBe("ASSIGNEE_NOT_MEMBER");
  });

  it("applies the same rule when a task is created with an assignee", async () => {
    const { workspace, base, byName, addTask } = await setupTasks();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const asMember = as(member);
    const create = (assigneeId: string) =>
      asMember.tasks.create({
        ...base,
        id: newTaskId(),
        columnId: byName("To Do").id,
        position: positionAt(5),
        title: "x",
        assigneeId,
      });

    const error = await rejection(create(colleague.id));
    const mine = await create(member.id);

    expect(error.data?.code).toBe("FORBIDDEN_ASSIGN");
    expect((await taskRow(mine.id))?.assigneeId).toBe(member.id);
    await addTask();
  });

  it("clears the assignments of a member who leaves the workspace", async () => {
    const { client, workspace, base, addTask } = await setupTasks();
    const leaver = await addWorkspaceMember(workspace.id, "member");
    const staying = await addWorkspaceMember(workspace.id, "member");
    const mine = await addTask();
    const theirs = await addTask();
    await client.tasks.updateAssignee({
      ...base,
      taskId: mine.id,
      assigneeId: leaver.id,
    });
    await client.tasks.updateAssignee({
      ...base,
      taskId: theirs.id,
      assigneeId: staying.id,
    });

    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, leaver.id));

    expect((await taskRow(mine.id))?.assigneeId).toBeNull();
    expect((await taskRow(theirs.id))?.assigneeId).toBe(staying.id);
  });

  it("leaves the assignments a user has in other workspaces alone", async () => {
    const { client, workspace, base, addTask } = await setupTasks();
    const other = await setupTasks("OTH");
    const shared = await addWorkspaceMember(workspace.id, "member");
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: shared.id,
      role: "member",
      joinedAt: new Date(),
    });
    const here = await addTask();
    const there = await other.addTask();
    await client.tasks.updateAssignee({
      ...base,
      taskId: here.id,
      assigneeId: shared.id,
    });
    await other.client.tasks.updateAssignee({
      ...other.base,
      taskId: there.id,
      assigneeId: shared.id,
    });

    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));

    expect((await taskRow(here.id))?.assigneeId).toBeNull();
    expect((await taskRow(there.id))?.assigneeId).toBe(shared.id);
  });
});

describe("moving and completing", () => {
  it("stamps completion on entering a done or canceled column and clears it on leaving", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const { id } = await addTask();

    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("Done").id,
      position: positionAt(0),
    });
    const completed = (await taskRow(id))?.completedAt;
    expect(completed).toBeInstanceOf(Date);

    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("Canceled").id,
      position: positionAt(0),
    });
    expect((await taskRow(id))?.completedAt).toEqual(completed);

    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("In Progress").id,
      position: positionAt(0),
    });
    expect((await taskRow(id))?.completedAt).toBeNull();
  });

  it("reorders within a column and returns the txid", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const first = await addTask();
    await addTask();

    const { txid } = await client.tasks.move({
      ...base,
      taskId: first.id,
      columnId: byName("To Do").id,
      position: positionAt(5),
    });

    expect((await taskRow(first.id))?.position).toBe(positionAt(5));
    expect(txid).toBe(await xminOfTask(first.id));
  });

  it("resolves a position another task holds, and refuses a bad key and a foreign column", async () => {
    const { client, base, workspace, byName, addTask } = await setupTasks();
    const first = await addTask();
    const second = await addTask();
    const other = await createProject(client, workspace.id, "OTH");
    const [foreign] = await columnsOf(other.id);
    const move = (columnId: string, position: string) =>
      client.tasks.move({ ...base, taskId: first.id, columnId, position });

    await move(byName("To Do").id, positionAt(1));
    const moved = (await taskRow(first.id))!.position;
    expect(moved > positionAt(1)).toBe(true);
    expect((await taskRow(second.id))?.position).toBe(positionAt(1));

    expect((await rejection(move(byName("To Do").id, "!!"))).data?.code).toBe(
      "INVALID_POSITION",
    );
    expect((await rejection(move(foreign!.id, positionAt(0)))).data?.code).toBe(
      "COLUMN_NOT_IN_PROJECT",
    );
  });

  it("lets a task stay where it is", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const { id } = await addTask();

    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("To Do").id,
      position: positionAt(0),
    });

    expect((await taskRow(id))?.position).toBe(positionAt(0));
  });

  it("brings the completion of a column's tasks in line when its category changes", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const open = await addTask("In Progress");
    const closed = await addTask("Done");
    const column = byName("In Progress");

    await client.projects.columns.move({
      ...base,
      columnId: column.id,
      category: "done",
      position: positionAt(5),
    });
    expect((await taskRow(open.id))?.completedAt).toBeInstanceOf(Date);

    await client.projects.columns.move({
      ...base,
      columnId: column.id,
      category: "started",
      position: positionAt(5),
    });
    expect((await taskRow(open.id))?.completedAt).toBeNull();
    expect((await taskRow(closed.id))?.completedAt).toBeInstanceOf(Date);
  });

  it("moves a deleted column's tasks to the end of the target, in order, and reconciles them", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const existing = await addTask("Done");
    const a = await addTask("In Progress");
    const b = await addTask("In Progress");
    const c = await addTask("In Progress");
    await client.tasks.move({
      ...base,
      taskId: a.id,
      columnId: byName("In Progress").id,
      position: positionAt(9),
    });

    await client.projects.columns.remove({
      ...base,
      columnId: byName("In Progress").id,
      targetColumnId: byName("Done").id,
    });

    const rows = await Promise.all(
      [existing, b, c, a].map((task) => taskRow(task.id)),
    );
    expect(rows.every((row) => row?.columnId === byName("Done").id)).toBe(true);
    const positions = rows.map((row) => row!.position);
    expect([...positions].sort()).toEqual(positions);
    expect(rows.every((row) => row?.completedAt instanceof Date)).toBe(true);
  });

  it("keeps archived tasks when their column is deleted", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const { id } = await addTask("In Progress");
    await client.tasks.archive({ ...base, taskId: id });

    await client.projects.columns.remove({
      ...base,
      columnId: byName("In Progress").id,
      targetColumnId: byName("To Do").id,
    });

    expect(await taskRow(id)).toMatchObject({
      columnId: byName("To Do").id,
    });
    expect((await taskRow(id))?.archivedAt).toBeInstanceOf(Date);
  });
});

describe("archiving", () => {
  it("keeps the column and position, and the task stays editable", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const { id } = await addTask("In Progress");
    const before = await taskRow(id);

    await client.tasks.archive({ ...base, taskId: id });
    await client.tasks.updateTitle({ ...base, taskId: id, title: "Fixed" });
    const archived = await taskRow(id);
    await client.tasks.unarchive({ ...base, taskId: id });
    const restored = await taskRow(id);

    expect(archived?.archivedAt).toBeInstanceOf(Date);
    expect(archived?.title).toBe("Fixed");
    expect(archived).toMatchObject({
      columnId: byName("In Progress").id,
      position: before?.position,
    });
    expect(restored?.archivedAt).toBeNull();
    expect(restored?.columnId).toBe(byName("In Progress").id);
  });

  it("archives the unarchived tasks of a closed column in one call", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const a = await addTask("Done");
    const b = await addTask("Done");
    const other = await addTask("To Do");
    await client.tasks.archive({ ...base, taskId: b.id });
    const archivedAt = (await taskRow(b.id))?.archivedAt;

    const result = await client.tasks.archiveCompleted({
      ...base,
      columnId: byName("Done").id,
    });

    expect(result.count).toBe(1);
    expect((await taskRow(a.id))?.archivedAt).toBeInstanceOf(Date);
    expect((await taskRow(b.id))?.archivedAt).toEqual(archivedAt);
    expect((await taskRow(other.id))?.archivedAt).toBeNull();
    expect(
      (
        await client.tasks.archiveCompleted({
          ...base,
          columnId: byName("Done").id,
        })
      ).txid,
    ).toBeNull();
  });

  it("refuses to archive an open column's tasks that way", async () => {
    const { client, base, byName } = await setupTasks();

    const error = await rejection(
      client.tasks.archiveCompleted({
        ...base,
        columnId: byName("In Progress").id,
      }),
    );

    expect(error.data?.code).toBe("COLUMN_NOT_CLOSED");
  });
});

describe("a task of an archived project", () => {
  it("refuses every write", async () => {
    const { client, base, byName, addTask } = await setupTasks();
    const { id } = await addTask();
    await client.projects.archive(base);
    const column = byName("To Do");
    const attempts = [
      () =>
        client.tasks.create({
          ...base,
          id: newTaskId(),
          columnId: column.id,
          position: positionAt(7),
          title: "x",
        }),
      () => client.tasks.updateTitle({ ...base, taskId: id, title: "x" }),
      () =>
        client.tasks.move({
          ...base,
          taskId: id,
          columnId: column.id,
          position: positionAt(7),
        }),
      () => client.tasks.archive({ ...base, taskId: id }),
      () => client.tasks.remove({ ...base, taskId: id }),
      () =>
        client.tasks.duplicate({
          ...base,
          taskId: id,
          id: newTaskId(),
          position: positionAt(7),
        }),
    ];

    for (const attempt of attempts) {
      expect((await rejection(attempt())).data?.code).toBe("PROJECT_ARCHIVED");
    }
  });
});

describe("duplicating", () => {
  it("copies the fields into the same column under a new number", async () => {
    const { client, base, workspace, byName, addTask } = await setupTasks();
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const { id } = await addTask("In Progress", {
      title: "Original",
      description: "Body",
      priority: "high",
      dueDate: "2026-05-05",
      assigneeId: colleague.id,
    });
    const copyId = newTaskId();

    const copy = await client.tasks.duplicate({
      ...base,
      taskId: id,
      id: copyId,
      position: positionAt(5),
    });

    expect(copy.number).toBe(2);
    expect(await taskRow(copyId)).toMatchObject({
      title: "Original (copy)",
      description: "Body",
      priority: "high",
      dueDate: "2026-05-05",
      assigneeId: colleague.id,
      columnId: byName("In Progress").id,
      archivedAt: null,
    });
  });

  it("drops an assignee the member could not assign", async () => {
    const { workspace, base, addTask } = await setupTasks();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const { id } = await addTask("To Do", { assigneeId: colleague.id });
    const copyId = newTaskId();

    await as(member).tasks.duplicate({
      ...base,
      taskId: id,
      id: copyId,
      position: positionAt(5),
    });

    expect((await taskRow(copyId))?.assigneeId).toBeNull();
  });
});

describe("who may change tasks", () => {
  it("lets a member create and update but not delete", async () => {
    const { workspace, base, addTask } = await setupTasks();
    const asMember = as(await addWorkspaceMember(workspace.id, "member"));
    const { id } = await addTask();

    await asMember.tasks.updateTitle({ ...base, taskId: id, title: "Mine" });
    const error = await rejection(
      asMember.tasks.remove({ ...base, taskId: id }),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect((await taskRow(id))?.title).toBe("Mine");
  });

  it("lets an admin do everything", async () => {
    const { workspace, base, addTask } = await setupTasks();
    const asAdmin = as(await addWorkspaceMember(workspace.id, "admin"));
    const { id } = await addTask();

    await asAdmin.tasks.remove({ ...base, taskId: id });

    expect(await taskRow(id)).toBeUndefined();
  });

  it("refuses a viewer every write", async () => {
    const { workspace, base, byName, addTask } = await setupTasks();
    const asViewer = as(await addWorkspaceMember(workspace.id, "viewer"));
    const { id } = await addTask();
    const attempts = [
      () =>
        asViewer.tasks.create({
          ...base,
          id: newTaskId(),
          columnId: byName("To Do").id,
          position: positionAt(7),
          title: "x",
        }),
      () => asViewer.tasks.updateTitle({ ...base, taskId: id, title: "x" }),
      () =>
        asViewer.tasks.updateAssignee({
          ...base,
          taskId: id,
          assigneeId: null,
        }),
      () => asViewer.tasks.archive({ ...base, taskId: id }),
      () => asViewer.tasks.remove({ ...base, taskId: id }),
      () => asViewer.tasks.import({ ...base, document: { tasks: [] } }),
    ];

    for (const attempt of attempts) {
      expect((await rejection(attempt())).code).toBe("FORBIDDEN");
    }
    expect((await asViewer.tasks.list(base)).map((task) => task.id)).toEqual([
      id,
    ]);
  });

  it("answers a non-member as if the workspace did not exist", async () => {
    const { base, addTask } = await setupTasks();
    const { id } = await addTask();
    const stranger = as((await setupTasks("OUT")).owner);

    const errors = await Promise.all([
      rejection(stranger.tasks.list(base)),
      rejection(
        stranger.tasks.updateTitle({ ...base, taskId: id, title: "x" }),
      ),
      rejection(stranger.tasks.export(base)),
    ]);

    for (const error of errors) expect(error.code).toBe("NOT_FOUND");
  });
});

describe("migration: task permissions for existing roles", () => {
  const migration = readFileSync(
    resolve(__dirname, "../../apps/api/drizzle/0015_tasks.sql"),
    "utf8",
  );
  const grantRolesStep = migration.slice(migration.indexOf("DO $$"));

  it("gives the default member and admin roles their task grants and leaves the rest", async () => {
    const { workspace } = await setupTasks();
    await db.insert(schema.workspaceRoleTable).values([
      {
        workspaceId: workspace.id,
        role: "member",
        permission: JSON.stringify({ workspace: ["read"] }),
      },
      {
        workspaceId: workspace.id,
        role: "admin",
        permission: JSON.stringify({ workspace: ["read"], task: ["create"] }),
      },
      {
        workspaceId: workspace.id,
        role: "viewer",
        permission: JSON.stringify({ workspace: ["read"] }),
      },
    ]);

    await db.execute(sql.raw(grantRolesStep));

    const rows = await db.select().from(schema.workspaceRoleTable);
    const permission = (role: string) =>
      JSON.parse(rows.find((row) => row.role === role)!.permission);
    expect(permission("member")).toEqual({
      workspace: ["read"],
      task: ["create", "update"],
    });
    expect(permission("admin")).toEqual({
      workspace: ["read"],
      task: ["create"],
    });
    expect(permission("viewer")).toEqual({ workspace: ["read"] });
  });
});

describe("task activity", () => {
  async function activity(workspaceId: string) {
    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.workspaceId, workspaceId))
      .orderBy(schema.activityTable.createdAt);
    return rows.filter((row) => row.type.startsWith("task."));
  }

  it("records created, completed, canceled and deleted with ticket id and title", async () => {
    const { client, workspace, base, byName, addTask } = await setupTasks();
    const { id } = await addTask("To Do", { title: "Write docs" });

    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("Done").id,
      position: positionAt(0),
    });
    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("Canceled").id,
      position: positionAt(0),
    });
    await client.tasks.remove({ ...base, taskId: id });

    const rows = await activity(workspace.id);
    expect(rows.map((row) => row.type)).toEqual([
      "task.created",
      "task.completed",
      "task.canceled",
      "task.deleted",
    ]);
    expect(rows[0]).toMatchObject({
      resourceType: "task",
      resourceId: id,
      eventData: expect.objectContaining({
        ticketId: "MOR-1",
        taskTitle: "Write docs",
      }),
    });
  });

  it("leaves edits, reorders, reopening, moves inside a category and archiving out", async () => {
    const { client, workspace, base, byName, addTask } = await setupTasks();
    const { id } = await addTask("Done");

    await client.tasks.updateTitle({ ...base, taskId: id, title: "Renamed" });
    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("Done").id,
      position: positionAt(6),
    });
    await client.tasks.move({
      ...base,
      taskId: id,
      columnId: byName("In Progress").id,
      position: positionAt(0),
    });
    await client.tasks.archive({ ...base, taskId: id });
    await client.tasks.unarchive({ ...base, taskId: id });

    expect((await activity(workspace.id)).map((row) => row.type)).toEqual([
      "task.created",
    ]);
  });
});

describe("deleting", () => {
  it("deletes a task with a project delete and with a workspace delete", async () => {
    const { client, workspace, base, addTask } = await setupTasks();
    const inProject = await addTask();
    const second = await setupTasks("TWO");
    const inWorkspace = await second.addTask();

    await client.projects.remove(base);
    expect(await taskRow(inProject.id)).toBeUndefined();

    await db
      .delete(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, second.workspace.id));
    expect(await taskRow(inWorkspace.id)).toBeUndefined();
    expect(workspace.id).not.toBe(second.workspace.id);
  });
});

describe("reading tasks on the server", () => {
  it("lists a project's tasks in board order with ticket id, column and assignee", async () => {
    const { client, owner, base, addTask } = await setupTasks();
    const done = await addTask("Done", { title: "Shipped" });
    const second = await addTask("To Do", { title: "Second" });
    const first = await addTask("To Do", { title: "First" });
    await client.tasks.move({
      ...base,
      taskId: first.id,
      columnId: (await columnsOf(base.projectId)).find(
        (column) => column.name === "To Do",
      )!.id,
      position: "Zz",
    });
    await client.tasks.updateAssignee({
      ...base,
      taskId: first.id,
      assigneeId: owner.id,
    });

    const listed = await client.tasks.list(base);

    expect(listed.map((task) => task.ticketId)).toEqual([
      "MOR-3",
      "MOR-2",
      "MOR-1",
    ]);
    expect(listed.map((task) => task.title)).toEqual([
      "First",
      "Second",
      "Shipped",
    ]);
    expect(listed[0]).toMatchObject({
      columnName: "To Do",
      category: "unstarted",
      assigneeId: owner.id,
      assigneeName: owner.name,
    });
    expect([done.id, second.id]).not.toContain(first.id);
  });
});

describe("importing and exporting", () => {
  it("round-trips fields, columns and assignees into another project", async () => {
    const source = await setupTasks("SRC");
    const target = await createProject(
      source.client,
      source.workspace.id,
      "DST",
    );
    const colleague = await addWorkspaceMember(source.workspace.id, "member");
    await source.addTask("In Progress", {
      title: "Alpha",
      description: "- [ ] one",
      priority: "high",
      dueDate: "2026-06-01",
      assigneeId: colleague.id,
    });
    const archived = await source.addTask("Done", { title: "Beta" });
    await source.client.tasks.archive({ ...source.base, taskId: archived.id });

    const document = await source.client.tasks.export(source.base);
    const result = await source.client.tasks.import({
      workspaceId: source.workspace.id,
      projectId: target.id,
      document,
    });
    const copied = await source.client.tasks.list({
      workspaceId: source.workspace.id,
      projectId: target.id,
    });

    expect(result).toMatchObject({ created: 2, warnings: [] });
    expect(document.project.key).toBe("SRC");
    expect(document.tasks.map((task) => task.assigneeEmail)).toContain(
      colleague.email,
    );
    expect(
      copied.map((task) => [
        task.ticketId,
        task.title,
        task.columnName,
        task.priority,
        task.dueDate,
        task.assigneeId,
        task.completedAt !== null,
        task.archivedAt !== null,
      ]),
    ).toEqual([
      [
        "DST-1",
        "Alpha",
        "In Progress",
        "high",
        "2026-06-01",
        colleague.id,
        false,
        false,
      ],
      ["DST-2", "Beta", "Done", "none", null, null, true, true],
    ]);
  });

  it("matches columns by name, then category, then the first unstarted, and warns", async () => {
    const { client, base, addTask } = await setupTasks();
    const document = {
      columns: [{ name: "Shipped", category: "done" }],
      tasks: [
        { title: "By name", column: "In Progress" },
        { title: "By file column", column: "Shipped" },
        { title: "By task category", column: "Gone", category: "canceled" },
        { title: "Fallback", column: "Nowhere" },
      ],
    };
    await addTask();

    const result = await client.tasks.import({ ...base, document });
    const tasks = (await client.tasks.list(base)).filter((task) =>
      document.tasks.some((imported) => imported.title === task.title),
    );

    expect(
      Object.fromEntries(tasks.map((t) => [t.title, t.columnName])),
    ).toEqual({
      "By name": "In Progress",
      "By file column": "Done",
      "By task category": "Canceled",
      Fallback: "To Do",
    });
    expect(result.warnings).toEqual([
      {
        kind: "column_unmatched",
        column: "Shipped",
        usedColumn: "Done",
        count: 1,
      },
      {
        kind: "column_unmatched",
        column: "Gone",
        usedColumn: "Canceled",
        count: 1,
      },
      {
        kind: "column_unmatched",
        column: "Nowhere",
        usedColumn: "To Do",
        count: 1,
      },
    ]);
  });

  it("warns about unknown assignee emails", async () => {
    const { client, base } = await setupTasks();

    const result = await client.tasks.import({
      ...base,
      document: {
        tasks: [
          { title: "A", column: "To Do", assigneeEmail: "nobody@example.com" },
          { title: "B", column: "To Do", assigneeEmail: "nobody@example.com" },
        ],
      },
    });

    expect(result.warnings).toEqual([
      { kind: "assignee_unknown", email: "nobody@example.com", count: 2 },
    ]);
  });

  it("drops assignees except the importer for a member without assign", async () => {
    const { workspace, base } = await setupTasks();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const asMember = as(member);

    const result = await asMember.tasks.import({
      ...base,
      document: {
        tasks: [
          { title: "Mine", column: "To Do", assigneeEmail: member.email },
          { title: "Theirs", column: "To Do", assigneeEmail: colleague.email },
        ],
      },
    });
    const byTitle = Object.fromEntries(
      (await asMember.tasks.list(base)).map((task) => [task.title, task]),
    );

    expect(result.created).toBe(2);
    expect(byTitle.Mine?.assigneeId).toBe(member.id);
    expect(byTitle.Theirs?.assigneeId).toBeNull();
    expect(result.warnings).toEqual([{ kind: "assignee_dropped", count: 1 }]);
  });

  it("appends to the columns' existing tasks and takes fresh numbers", async () => {
    const { client, base, addTask } = await setupTasks();
    const existing = await addTask("To Do", { title: "Existing" });

    await client.tasks.import({
      ...base,
      document: {
        tasks: [
          { number: 7, title: "Seven", column: "To Do" },
          { number: 3, title: "Three", column: "To Do" },
        ],
      },
    });
    const listed = await client.tasks.list(base);

    expect(listed.map((task) => task.title)).toEqual([
      "Existing",
      "Seven",
      "Three",
    ]);
    expect(
      Object.fromEntries(listed.map((task) => [task.title, task.number])),
    ).toEqual({ Existing: existing.number, Three: 2, Seven: 3 });
  });

  it("rejects files over the limits and malformed documents", async () => {
    const { client, base } = await setupTasks();

    const tooMany = await rejection(
      client.tasks.import({
        ...base,
        document: {
          tasks: Array.from({ length: 5001 }, () => ({ title: "x" })),
        },
      }),
    );
    const tooBig = await rejection(
      client.tasks.import({
        ...base,
        document: {
          tasks: [{ title: "x", description: "y".repeat(5 * 1024 * 1024) }],
        },
      }),
    );
    const invalid = await rejection(
      client.tasks.import({ ...base, document: { tasks: [{ title: "" }] } }),
    );

    expect(tooMany.data?.code).toBe("IMPORT_TOO_LARGE");
    expect(tooBig.data?.code).toBe("IMPORT_TOO_LARGE");
    expect(invalid.data?.code).toBe("IMPORT_INVALID");
  });

  it("imports 5,000 tasks in one go", async () => {
    const { client, base } = await setupTasks();

    const result = await client.tasks.import({
      ...base,
      document: {
        tasks: Array.from({ length: 5000 }, (_, index) => ({
          title: `Task ${index}`,
          number: index + 1,
        })),
      },
    });

    expect(result.created).toBe(5000);
    expect((await client.tasks.list(base)).length).toBe(5000);
  });

  it("rolls the whole import back when a row fails", async () => {
    const { client, base } = await setupTasks();
    // A row Postgres refuses at the end of the batch.
    await db.execute(
      sql`ALTER TABLE task ADD CONSTRAINT import_probe CHECK (title <> 'boom') NOT VALID`,
    );

    const error = await rejection(
      client.tasks.import({
        ...base,
        document: {
          tasks: [
            { title: "fine", column: "To Do" },
            { title: "boom", column: "To Do" },
          ],
        },
      }),
    );

    await db.execute(sql`ALTER TABLE task DROP CONSTRAINT import_probe`);
    expect(error).toBeDefined();
    expect(await client.tasks.list(base)).toEqual([]);
    expect(
      (
        await db
          .select({ last: schema.projectTable.lastTaskNumber })
          .from(schema.projectTable)
          .where(eq(schema.projectTable.id, base.projectId))
      )[0]?.last,
    ).toBe(0);
  });

  it("lets a viewer export", async () => {
    const { workspace, base, addTask } = await setupTasks();
    await addTask();
    const asViewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const document = await asViewer.tasks.export(base);

    expect(document.tasks).toHaveLength(1);
  });
});
