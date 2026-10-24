import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { storyOf } from "./helpers/history";
import { labelFactory } from "./helpers/labels";
import { as, rejection } from "./helpers/projects";
import { newTaskId, positionAt, setupTasks, taskRow } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const { client, workspace, base } = context;
  const addLabel = labelFactory(client, workspace.id);
  async function addTasks(count: number, column = "To Do") {
    const ids: string[] = [];
    for (let n = 0; n < count; n++)
      ids.push((await context.addTask(column)).id);
    return ids;
  }
  return {
    ...context,
    addLabel,
    addTasks,
    update: (
      taskIds: string[],
      change: Parameters<typeof client.tasks.bulkUpdate>[0]["change"],
    ) => client.tasks.bulkUpdate({ ...base, taskIds, change }),
  };
}

describe("bulk changes", () => {
  it("sets a start date on every task, and a due date before it clears the start", async () => {
    const { addTasks, update } = await setup();
    const ids = await addTasks(2);

    await update(ids, { type: "dueDate", dueDate: "2026-12-31" });
    await update(ids, { type: "startDate", startDate: "2026-12-10" });
    for (const id of ids) {
      expect(await taskRow(id)).toMatchObject({
        startAt: new Date("2026-12-10T00:00:00Z"),
        startHasTime: false,
      });
    }

    await update(ids, { type: "dueDate", dueDate: "2026-12-01" });
    for (const id of ids) {
      expect(await taskRow(id)).toMatchObject({ startAt: null });
    }
  });

  it("sets a due moment on every task, then a day over it", async () => {
    const { addTasks, update } = await setup();
    const ids = await addTasks(2);

    await update(ids, {
      type: "dueDate",
      dueDate: "2026-12-31T23:30:00-08:00",
    });
    for (const id of ids) {
      expect(await taskRow(id)).toMatchObject({
        dueAt: new Date("2027-01-01T07:30:00Z"),
        dueHasTime: true,
      });
    }

    await update(ids, { type: "dueDate", dueDate: "2026-12-31" });
    for (const id of ids) {
      expect(await taskRow(id)).toMatchObject({
        dueAt: new Date("2026-12-31T00:00:00Z"),
        dueHasTime: false,
      });
    }
  });

  it("returns one txid for the whole batch, for every kind of change", async () => {
    const { byName, addLabel, addTasks, update, owner } = await setup();
    const ids = await addTasks(3);
    const label = await addLabel("bug");
    const changes = [
      { type: "move", columnId: byName("In Progress").id },
      { type: "priority", priority: "high" },
      { type: "assignee", assigneeId: owner.id },
      { type: "dueDate", dueDate: "2026-12-31" },
      { type: "addLabel", labelId: label.id },
      { type: "removeLabel", labelId: label.id },
      { type: "archive", archived: true },
    ] as const;

    for (const change of changes) {
      const result = await update(ids, change);
      expect(result.txid).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);
    }

    const rows = await Promise.all(ids.map(taskRow));
    for (const row of rows) {
      expect(row).toMatchObject({
        columnId: byName("In Progress").id,
        priority: "high",
        assigneeId: owner.id,
        dueAt: new Date("2026-12-31T00:00:00Z"),
        labelIds: [],
      });
      expect(row?.archivedAt).not.toBeNull();
    }
  });

  it("skips ids that are missing or belong to another project and applies the rest", async () => {
    const { client, workspace, addTasks, update } = await setup();
    const [first, second] = await addTasks(2);
    const other = await setupTasks("OTH");
    const foreign = await other.addTask();

    const result = await update([first!, newTaskId(), foreign.id, second!], {
      type: "priority",
      priority: "urgent",
    });

    expect(result.skipped).toBe(2);
    expect((await taskRow(first!))?.priority).toBe("urgent");
    expect((await taskRow(second!))?.priority).toBe("urgent");
    expect((await taskRow(foreign.id))?.priority).toBe("none");
    expect(client).toBeDefined();
    expect(workspace.id).toBeDefined();
  });

  it("accepts 200 ids and rejects 201", async () => {
    const { update } = await setup();
    const ids = Array.from({ length: 201 }, () => newTaskId());

    const tooMany = await rejection(
      update(ids, { type: "priority", priority: "low" }),
    );
    const allowed = await update(ids.slice(0, 200), {
      type: "priority",
      priority: "low",
    });

    expect(tooMany.code).toBe("BAD_REQUEST");
    expect(allowed.skipped).toBe(200);
  });

  it("counts a repeated id once", async () => {
    const { addTasks, update } = await setup();
    const [id] = await addTasks(1);

    const result = await update([id!, id!], {
      type: "priority",
      priority: "low",
    });

    expect(result.skipped).toBe(0);
    expect(await taskRow(id!)).toMatchObject({ priority: "low" });
  });
});

describe("history of a bulk change", () => {
  it("records one event per task that really changed and none for no-ops", async () => {
    const { client, base, addTasks, update } = await setup();
    const [changed, same] = await addTasks(2);
    await client.tasks.updatePriority({
      ...base,
      taskId: same!,
      priority: "high",
    });
    const before = await storyOf(same!);

    await update([changed!, same!], { type: "priority", priority: "high" });

    expect(await storyOf(changed!)).toEqual([
      { type: "created", data: {} },
      { type: "priority", data: { from: "none", to: "high" } },
    ]);
    expect(await storyOf(same!)).toEqual(before);
  });

  it("records labels, assignee, due date and archiving as single edits would", async () => {
    const { owner, addTasks, addLabel, update } = await setup();
    const [id] = await addTasks(1);
    const label = await addLabel("bug");

    await update([id!], { type: "addLabel", labelId: label.id });
    await update([id!], { type: "assignee", assigneeId: owner.id });
    await update([id!], { type: "dueDate", dueDate: "2026-05-01" });
    await update([id!], { type: "archive", archived: true });
    await update([id!], { type: "archive", archived: false });

    const types = (await storyOf(id!)).map((event) => event.type);
    expect(types).toEqual([
      "created",
      "labels",
      "assignee",
      "due_date",
      "archived",
      "unarchived",
    ]);
  });
});

describe("rolling back", () => {
  it("fails the whole batch when any task would pass the label limit", async () => {
    const { addTasks, addLabel, update } = await setup();
    const [full, fine] = await addTasks(2);
    const label = await addLabel("bug");
    await db
      .update(schema.taskTable)
      .set({ labelIds: Array.from({ length: 20 }, (_, n) => `other-${n}`) })
      .where(eq(schema.taskTable.id, full!));

    const error = await rejection(
      update([fine!, full!], { type: "addLabel", labelId: label.id }),
    );

    expect(error.data?.code).toBe("LABEL_LIMIT_REACHED");
    expect((await taskRow(fine!))?.labelIds).toEqual([]);
  });

  it("fails the whole batch for an assignee who is not a member", async () => {
    const { addTasks, update } = await setup();
    const outsider = await addWorkspaceMember(
      (await setupTasks("OUT")).workspace.id,
    );
    const [id] = await addTasks(1);

    const error = await rejection(
      update([id!], { type: "assignee", assigneeId: outsider.id }),
    );

    expect(error.data?.code).toBe("ASSIGNEE_NOT_MEMBER");
    expect((await taskRow(id!))?.assigneeId).toBeNull();
  });

  it("fails the whole batch for a column outside the project", async () => {
    const { addTasks, update } = await setup();
    const other = await setupTasks("OTH");
    const [id] = await addTasks(1);

    const error = await rejection(
      update([id!], { type: "move", columnId: other.byName("Done").id }),
    );

    expect(error.data?.code).toBe("COLUMN_NOT_IN_PROJECT");
  });
});

describe("moving a batch", () => {
  it("appends in the order given, after archived tasks, and leaves tasks already there", async () => {
    const { client, base, byName, addTask, addTasks, update } = await setup();
    const archived = await addTask("In Progress");
    await client.tasks.archive({ ...base, taskId: archived.id });
    const resident = await addTask("In Progress");
    const [a, b, c] = await addTasks(3);

    await update([c!, resident.id, a!, b!], {
      type: "move",
      columnId: byName("In Progress").id,
    });

    const rows = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.columnId, byName("In Progress").id));
    const ordered = rows
      .sort((x, y) => (x.position < y.position ? -1 : 1))
      .map((row) => row.id);
    expect(ordered).toEqual([archived.id, resident.id, c, a, b]);
    expect((await taskRow(resident.id))?.position).toBe(positionAt(1));
  });

  it("stamps completedAt entering a done column, clears it leaving, and records activity per task", async () => {
    const { workspace, byName, addTasks, update } = await setup();
    const ids = await addTasks(2);

    await update(ids, { type: "move", columnId: byName("Done").id });
    expect((await taskRow(ids[0]!))?.completedAt).not.toBeNull();
    expect((await storyOf(ids[0]!)).map((e) => e.type)).toEqual([
      "created",
      "column",
    ]);
    await update(ids, { type: "move", columnId: byName("Canceled").id });
    await update(ids, { type: "move", columnId: byName("To Do").id });

    expect((await taskRow(ids[0]!))?.completedAt).toBeNull();
    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.workspaceId, workspace.id));
    const types = rows
      .map((row) => row.type)
      .filter((t) => t.startsWith("task.") && t !== "task.created");
    expect(types.sort()).toEqual([
      "task.canceled",
      "task.canceled",
      "task.completed",
      "task.completed",
    ]);
  });
});

describe("archiving a batch", () => {
  it("archives only the tasks that are not archived yet", async () => {
    const { client, base, addTasks, update } = await setup();
    const [old, fresh] = await addTasks(2);
    await client.tasks.archive({ ...base, taskId: old! });
    const archivedAt = (await taskRow(old!))?.archivedAt;

    await update([old!, fresh!], { type: "archive", archived: true });

    expect((await taskRow(old!))?.archivedAt).toEqual(archivedAt);
    expect((await taskRow(fresh!))?.archivedAt).not.toBeNull();
    expect(
      (await storyOf(old!)).filter((e) => e.type === "archived"),
    ).toHaveLength(1);
  });
});

describe("removing a batch", () => {
  it("deletes the tasks and records one task.deleted each", async () => {
    const { client, workspace, base, addTasks } = await setup();
    const ids = await addTasks(3);

    const result = await client.tasks.bulkRemove({
      ...base,
      taskIds: [...ids.slice(0, 2), newTaskId()],
    });

    expect(result.skipped).toBe(1);
    expect(await taskRow(ids[0]!)).toBeUndefined();
    expect(await taskRow(ids[2]!)).toBeDefined();
    const deleted = (
      await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.workspaceId, workspace.id))
    ).filter((row) => row.type === "task.deleted");
    expect(deleted.map((row) => row.resourceId).sort()).toEqual(
      ids.slice(0, 2).sort(),
    );
  });
});

describe("who may change a batch", () => {
  it("lets a member update, assign to themselves, but not assign others or delete", async () => {
    const { workspace, base, addTasks } = await setup();
    const member = await addWorkspaceMember(workspace.id, "member");
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const asMember = as(member);
    const ids = await addTasks(2);

    await asMember.tasks.bulkUpdate({
      ...base,
      taskIds: ids,
      change: { type: "priority", priority: "low" },
    });
    await asMember.tasks.bulkUpdate({
      ...base,
      taskIds: ids,
      change: { type: "assignee", assigneeId: member.id },
    });
    const others = await rejection(
      asMember.tasks.bulkUpdate({
        ...base,
        taskIds: ids,
        change: { type: "assignee", assigneeId: colleague.id },
      }),
    );
    const removal = await rejection(
      asMember.tasks.bulkRemove({ ...base, taskIds: ids }),
    );

    expect(others.data?.code).toBe("FORBIDDEN_ASSIGN");
    expect(removal.code).toBe("FORBIDDEN");
    expect((await taskRow(ids[0]!))?.assigneeId).toBe(member.id);
  });

  it("refuses a viewer", async () => {
    const { workspace, base, addTasks } = await setup();
    const asViewer = as(await addWorkspaceMember(workspace.id, "viewer"));
    const ids = await addTasks(1);

    const update = await rejection(
      asViewer.tasks.bulkUpdate({
        ...base,
        taskIds: ids,
        change: { type: "priority", priority: "low" },
      }),
    );
    const remove = await rejection(
      asViewer.tasks.bulkRemove({ ...base, taskIds: ids }),
    );

    expect([update.code, remove.code]).toEqual(["FORBIDDEN", "FORBIDDEN"]);
  });

  it("refuses a batch in an archived project", async () => {
    const { client, base, addTasks, update } = await setup();
    const ids = await addTasks(1);
    await client.projects.archive(base);

    const changed = await rejection(
      update(ids, { type: "priority", priority: "low" }),
    );
    const removed = await rejection(
      client.tasks.bulkRemove({ ...base, taskIds: ids }),
    );

    expect(changed.data?.code).toBe("PROJECT_ARCHIVED");
    expect(removed.data?.code).toBe("PROJECT_ARCHIVED");
  });
});
