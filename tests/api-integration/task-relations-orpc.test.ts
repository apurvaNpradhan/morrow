import { asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { storyOf } from "./helpers/history";
import { as, columnsOf, rejection } from "./helpers/projects";
import { newTaskId, positionAt, setupTasks } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

function newRelationId() {
  return newTaskId();
}

async function relationRows() {
  return db
    .select()
    .from(schema.taskRelationTable)
    .orderBy(asc(schema.taskRelationTable.createdAt));
}

async function xminOfRelation(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM task_relation WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}

async function setup() {
  const context = await setupTasks();
  const { client, workspace } = context;
  const second = await client.projects.create({
    workspaceId: workspace.id,
    name: "Other",
    key: "OTH",
  });
  const secondColumns = await columnsOf(second.id);
  let placed = 0;
  const addElsewhere = async (title = "Elsewhere") => {
    const id = newTaskId();
    await client.tasks.create({
      workspaceId: workspace.id,
      projectId: second.id,
      id,
      columnId: secondColumns[0]!.id,
      position: positionAt(placed++),
      title,
    });
    return { id };
  };
  const relate = (
    type: "blocks" | "related" | "duplicate",
    sourceTaskId: string,
    targetTaskId: string,
  ) =>
    client.relations.add({
      workspaceId: workspace.id,
      id: newRelationId(),
      type,
      sourceTaskId,
      targetTaskId,
    });
  return { ...context, second, addElsewhere, relate };
}

describe("adding a relation", () => {
  it("creates all three types, returning the txid", async () => {
    const { addTask, relate, owner } = await setup();
    const a = await addTask();
    const b = await addTask();

    for (const type of ["blocks", "related", "duplicate"] as const) {
      await relate(type, a.id, b.id);
    }

    const rows = await relationRows();
    expect(rows.map((row) => row.type).sort()).toEqual([
      "blocks",
      "duplicate",
      "related",
    ]);
    expect(rows[0]).toMatchObject({ sourceTaskId: a.id, createdBy: owner.id });
    const created = await relate("blocks", b.id, (await addTask()).id);
    const last = (await relationRows()).at(-1)!;
    expect(created.txid).toBe(await xminOfRelation(last.id));
  });

  it("makes related one row whichever task it is added from", async () => {
    const { addTask, relate } = await setup();
    const a = await addTask();
    const b = await addTask();

    await relate("related", a.id, b.id);
    const again = await rejection(relate("related", b.id, a.id));

    const rows = await relationRows();
    expect(rows).toHaveLength(1);
    expect([rows[0]!.sourceTaskId, rows[0]!.targetTaskId]).toEqual(
      [a.id, b.id].sort(),
    );
    expect(again).toMatchObject({ data: { code: "RELATION_EXISTS" } });
  });

  it("links tasks of different projects", async () => {
    const { addTask, addElsewhere, relate } = await setup();
    const a = await addTask();
    const far = await addElsewhere();

    await relate("blocks", a.id, far.id);

    expect(await relationRows()).toHaveLength(1);
  });

  it("refuses itself, a repeat and a malformed id with typed errors", async () => {
    const { addTask, relate, client, workspace } = await setup();
    const a = await addTask();
    const b = await addTask();

    const self = await rejection(relate("related", a.id, a.id));
    await relate("blocks", a.id, b.id);
    const repeat = await rejection(relate("blocks", a.id, b.id));
    const badId = await rejection(
      client.relations.add({
        workspaceId: workspace.id,
        id: "nope",
        type: "related",
        sourceTaskId: a.id,
        targetTaskId: b.id,
      }),
    );

    expect(self).toMatchObject({ data: { code: "RELATION_SELF" } });
    expect(repeat).toMatchObject({ data: { code: "RELATION_EXISTS" } });
    expect(badId).toMatchObject({ data: { code: "INVALID_RELATION_ID" } });
  });

  it("refuses loops of blocks of length 2 and 3, across projects too", async () => {
    const { addTask, addElsewhere, relate } = await setup();
    const a = await addTask();
    const b = await addElsewhere();
    const c = await addTask();

    await relate("blocks", a.id, b.id);
    const two = await rejection(relate("blocks", b.id, a.id));
    await relate("blocks", b.id, c.id);
    const three = await rejection(relate("blocks", c.id, a.id));

    expect(two).toMatchObject({ data: { code: "RELATION_CYCLE" } });
    expect(three).toMatchObject({ data: { code: "RELATION_CYCLE" } });
    expect(await relationRows()).toHaveLength(2);
  });

  it("does not treat related or duplicate pairs as loops", async () => {
    const { addTask, relate } = await setup();
    const a = await addTask();
    const b = await addTask();

    await relate("blocks", a.id, b.id);
    await relate("related", b.id, a.id);
    await relate("duplicate", b.id, a.id);

    expect(await relationRows()).toHaveLength(3);
  });

  it("refuses a task of another workspace", async () => {
    const { addTask, relate } = await setup();
    const a = await addTask();
    const { workspace: other } = await createWorkspaceMember({
      role: "owner",
    });
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: other.id,
        name: "Foreign",
        key: "FOR",
        position: "a0",
      })
      .returning();
    const [column] = await db
      .insert(schema.projectColumnTable)
      .values({
        projectId: project!.id,
        name: "To Do",
        category: "unstarted",
        color: "#888888",
        position: "a0",
      })
      .returning();
    const [foreign] = await db
      .insert(schema.taskTable)
      .values({
        id: newTaskId(),
        projectId: project!.id,
        columnId: column!.id,
        number: 1,
        title: "Foreign",
        position: "a0",
      })
      .returning();

    const refused = await rejection(relate("related", a.id, foreign!.id));

    expect(refused).toMatchObject({
      data: { code: "RELATION_TASK_NOT_IN_WORKSPACE" },
    });
    expect(await relationRows()).toHaveLength(0);
  });

  it("is refused to a Viewer", async () => {
    const { addTask, workspace, relate } = await setup();
    const a = await addTask();
    const b = await addTask();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const refused = await rejection(
      viewer.relations.add({
        workspaceId: workspace.id,
        id: newRelationId(),
        type: "related",
        sourceTaskId: a.id,
        targetTaskId: b.id,
      }),
    );

    expect(refused.code).toBe("FORBIDDEN");
    expect(await relationRows()).toHaveLength(0);
    void relate;
  });

  it("is refused in an archived project", async () => {
    const { addTask, relate, client, workspace, projectId } = await setup();
    const a = await addTask();
    const b = await addTask();
    await client.projects.archive({ workspaceId: workspace.id, projectId });

    const refused = await rejection(relate("related", a.id, b.id));

    expect(refused).toMatchObject({ data: { code: "PROJECT_ARCHIVED" } });
  });
});

describe("removing a relation", () => {
  it("deletes it, returning the txid, and refuses an unknown one", async () => {
    const { addTask, relate, client, workspace } = await setup();
    const a = await addTask();
    const b = await addTask();
    await relate("blocks", a.id, b.id);
    const [row] = await relationRows();

    const removed = await client.relations.delete({
      workspaceId: workspace.id,
      relationId: row!.id,
    });
    const again = await rejection(
      client.relations.delete({
        workspaceId: workspace.id,
        relationId: row!.id,
      }),
    );

    expect(removed.txid).toBeGreaterThan(0);
    expect(await relationRows()).toHaveLength(0);
    expect(again.code).toBe("NOT_FOUND");
  });

  it("goes when either task is deleted", async () => {
    const { addTask, relate, client, base } = await setup();
    const a = await addTask();
    const b = await addTask();
    const c = await addTask();
    await relate("blocks", a.id, b.id);
    await relate("related", c.id, b.id);

    await client.tasks.remove({ ...base, taskId: a.id });
    expect(await relationRows()).toHaveLength(1);
    await client.tasks.remove({ ...base, taskId: b.id });
    expect(await relationRows()).toHaveLength(0);
  });

  it("is not copied when a task is duplicated", async () => {
    const { addTask, relate, client, base, byName, nextPosition } =
      await setup();
    const a = await addTask();
    const b = await addTask();
    await relate("blocks", a.id, b.id);

    await client.tasks.duplicate({
      ...base,
      taskId: a.id,
      id: newTaskId(),
      position: nextPosition(byName("To Do").id),
    });

    expect(await relationRows()).toHaveLength(1);
  });
});

describe("history", () => {
  it("lands on both tasks, across projects, for add and remove", async () => {
    const { addTask, addElsewhere, relate, client, workspace } = await setup();
    const a = await addTask();
    const far = await addElsewhere();
    const own = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, a.id));
    expect(own).toHaveLength(1);

    await relate("blocks", a.id, far.id);
    const [row] = await relationRows();
    await client.relations.delete({
      workspaceId: workspace.id,
      relationId: row!.id,
    });

    expect((await storyOf(a.id)).slice(-2)).toEqual([
      {
        type: "relation_added",
        data: { type: "blocks", direction: "outgoing", ticketId: "OTH-1" },
      },
      {
        type: "relation_removed",
        data: { type: "blocks", direction: "outgoing", ticketId: "OTH-1" },
      },
    ]);
    expect(await storyOf(far.id)).toEqual([
      { type: "created", data: {} },
      {
        type: "relation_added",
        data: { type: "blocks", direction: "incoming", ticketId: "MOR-1" },
      },
      {
        type: "relation_removed",
        data: { type: "blocks", direction: "incoming", ticketId: "MOR-1" },
      },
    ]);
  });
});

describe("reading a task's relations", () => {
  it("lists them with the other task's ticket id, title and direction", async () => {
    const { addTask, addElsewhere, relate, client, base } = await setup();
    const a = await addTask("To Do", { title: "A" });
    const far = await addElsewhere("Far");
    await relate("blocks", far.id, a.id);

    const task = await client.tasks.get({ ...base, ticketId: "MOR-1" });

    expect(task.relations).toMatchObject([
      {
        type: "blocks",
        direction: "incoming",
        kind: "blocked_by",
        ticketId: "OTH-1",
        title: "Far",
      },
    ]);
  });
});
