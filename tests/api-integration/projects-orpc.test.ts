import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  as,
  columnsOf,
  rejection,
  setupWorkspace as setup,
} from "./helpers/projects";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function xminOf(projectId: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM project WHERE id = ${projectId}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("creating a project", () => {
  it("seeds the default columns in workflow order and returns the txid", async () => {
    const { client, workspace } = await setup();

    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    expect(created.txid).toBe(await xminOf(created.id));
    const columns = await columnsOf(created.id);
    expect(
      columns
        .map((column) => [column.name, column.category, column.color])
        .sort(),
    ).toEqual(
      [
        ["Backlog", "backlog", "gray"],
        ["To Do", "unstarted", "slate"],
        ["In Progress", "started", "blue"],
        ["Done", "done", "green"],
        ["Canceled", "canceled", "red"],
      ].sort(),
    );
    const listed = await client.projects.list({ workspaceId: workspace.id });
    expect(listed[0]?.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });

  it("puts each new project after the previous ones", async () => {
    const { client, workspace } = await setup();

    await client.projects.create({
      workspaceId: workspace.id,
      name: "First",
      key: "ONE",
    });
    await client.projects.create({
      workspaceId: workspace.id,
      name: "Second",
      key: "TWO",
    });
    await client.projects.create({
      workspaceId: workspace.id,
      name: "Third",
      key: "THR",
    });

    const listed = await client.projects.list({ workspaceId: workspace.id });
    expect(listed.map((project) => project.key)).toEqual(["ONE", "TWO", "THR"]);
  });

  it("stores the optional fields and starts the task counter at zero", async () => {
    const { client, workspace } = await setup();

    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
      icon: "Rocket",
      color: "blue",
      description: "The personal workspace platform",
    });

    const [row] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, created.id));
    expect(row).toMatchObject({
      name: "Morrow",
      icon: "Rocket",
      color: "blue",
      description: "The personal workspace platform",
      lastTaskNumber: 0,
      archivedAt: null,
      backgroundUrl: null,
    });
  });

  it("normalises the key to upper case", async () => {
    const { client, workspace } = await setup();

    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: " mor ",
    });

    const [row] = await db
      .select({ key: schema.projectTable.key })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, created.id));
    expect(row?.key).toBe("MOR");
  });

  it.each(["A", "TOOLONG7", "1AB", "AB-C", "AB C", "ÄÖ"])(
    "rejects the key %j",
    async (key) => {
      const { client, workspace } = await setup();

      const error = await rejection(
        client.projects.create({ workspaceId: workspace.id, name: "X", key }),
      );

      expect(error.code).toBe("BAD_REQUEST");
    },
  );

  it("rejects an icon that is not on the list", async () => {
    const { client, workspace } = await setup();

    const error = await rejection(
      client.projects.create({
        workspaceId: workspace.id,
        name: "X",
        key: "XYZ",
        icon: "NotAnIcon" as never,
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });

  it("refuses a key the workspace already uses, even by an archived project", async () => {
    const { client, workspace } = await setup();
    const first = await client.projects.create({
      workspaceId: workspace.id,
      name: "First",
      key: "MOR",
    });

    const taken = await rejection(
      client.projects.create({
        workspaceId: workspace.id,
        name: "Other",
        key: "MOR",
      }),
    );
    expect(taken.code).toBe("CONFLICT");
    expect(taken.data?.code).toBe("PROJECT_KEY_TAKEN");

    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: first.id,
    });
    const stillTaken = await rejection(
      client.projects.create({
        workspaceId: workspace.id,
        name: "Other",
        key: "MOR",
      }),
    );
    expect(stillTaken.data?.code).toBe("PROJECT_KEY_TAKEN");
  });

  it("allows the same key in another workspace", async () => {
    const { client, workspace } = await setup();
    await client.projects.create({
      workspaceId: workspace.id,
      name: "First",
      key: "MOR",
    });
    const { user: otherOwner, workspace: other } = await createWorkspaceMember({
      role: "owner",
    });

    const created = await as(otherOwner).projects.create({
      workspaceId: other.id,
      name: "Elsewhere",
      key: "MOR",
    });

    expect(created.id).toBeTruthy();
  });
});

describe("who may change projects", () => {
  it("lets a member create and update but not delete", async () => {
    const { client, workspace } = await setup();
    const member = await addWorkspaceMember(workspace.id, "member");
    const asMember = as(member);

    const created = await asMember.projects.create({
      workspaceId: workspace.id,
      name: "Mine",
      key: "MIN",
    });
    await asMember.projects.update({
      workspaceId: workspace.id,
      projectId: created.id,
      name: "Renamed",
    });
    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: created.id,
    });

    const error = await rejection(
      as(member).projects.remove({
        workspaceId: workspace.id,
        projectId: created.id,
      }),
    );
    expect(error.code).toBe("FORBIDDEN");
  });

  it("lets an admin delete an archived project", async () => {
    const { client, workspace } = await setup();
    const admin = await addWorkspaceMember(workspace.id, "admin");
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Old",
      key: "OLD",
    });
    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: created.id,
    });

    await as(admin).projects.remove({
      workspaceId: workspace.id,
      projectId: created.id,
    });

    expect(
      await db
        .select()
        .from(schema.projectTable)
        .where(and(eq(schema.projectTable.id, created.id))),
    ).toEqual([]);
    expect(await columnsOf(created.id)).toEqual([]);
  });

  it("lets a viewer read but not change anything", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });
    const viewer = await addWorkspaceMember(workspace.id, "viewer");
    const asViewer = as(viewer);

    expect(
      (await asViewer.projects.list({ workspaceId: workspace.id })).length,
    ).toBe(1);
    const denied = [
      () =>
        asViewer.projects.create({
          workspaceId: workspace.id,
          name: "Nope",
          key: "NOP",
        }),
      () =>
        asViewer.projects.update({
          workspaceId: workspace.id,
          projectId: created.id,
          name: "Nope",
        }),
      () =>
        asViewer.projects.archive({
          workspaceId: workspace.id,
          projectId: created.id,
        }),
    ];
    for (const call of denied) {
      expect((await rejection(call())).code).toBe("FORBIDDEN");
    }
  });

  it("answers a stranger with not found", async () => {
    const { workspace } = await setup();
    const { user: stranger } = await createWorkspaceMember();

    const error = await rejection(
      as(stranger).projects.list({ workspaceId: workspace.id }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("does not let a project of another workspace be changed through this one", async () => {
    const { client, workspace } = await setup();
    const { user: otherOwner, workspace: other } = await createWorkspaceMember({
      role: "owner",
    });
    const foreign = await as(otherOwner).projects.create({
      workspaceId: other.id,
      name: "Foreign",
      key: "FOR",
    });

    const error = await rejection(
      client.projects.update({
        workspaceId: workspace.id,
        projectId: foreign.id,
        name: "Hijacked",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("editing a project", () => {
  it("changes the name, description and icon and returns the txid", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    const { txid } = await client.projects.update({
      workspaceId: workspace.id,
      projectId: created.id,
      name: "Morrow 2",
      description: "Now with a description",
      icon: "Rocket",
    });

    expect(txid).toBe(await xminOf(created.id));
    const [row] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, created.id));
    expect(row).toMatchObject({
      name: "Morrow 2",
      description: "Now with a description",
      icon: "Rocket",
    });
  });

  it("clears the description and the icon", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
      icon: "Rocket",
      description: "Something",
    });

    await client.projects.update({
      workspaceId: workspace.id,
      projectId: created.id,
      description: "",
      icon: null,
    });

    const [row] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, created.id));
    expect(row).toMatchObject({ description: null, icon: null });
  });

  it("refuses an update that changes nothing", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    const error = await rejection(
      client.projects.update({
        workspaceId: workspace.id,
        projectId: created.id,
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });
});

describe("changing a project key", () => {
  it("moves the project to the new key and frees the old one", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "OLD",
    });

    const changed = await client.projects.changeKey({
      workspaceId: workspace.id,
      projectId: created.id,
      key: "new",
    });

    expect(changed.txid).toBe(await xminOf(created.id));
    const [row] = await db
      .select({ key: schema.projectTable.key })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, created.id));
    expect(row?.key).toBe("NEW");
    const reused = await client.projects.create({
      workspaceId: workspace.id,
      name: "Another",
      key: "OLD",
    });
    expect(reused.id).toBeTruthy();
  });

  it("refuses a key another project uses", async () => {
    const { client, workspace } = await setup();
    await client.projects.create({
      workspaceId: workspace.id,
      name: "One",
      key: "ONE",
    });
    const two = await client.projects.create({
      workspaceId: workspace.id,
      name: "Two",
      key: "TWO",
    });

    const error = await rejection(
      client.projects.changeKey({
        workspaceId: workspace.id,
        projectId: two.id,
        key: "ONE",
      }),
    );

    expect(error.data?.code).toBe("PROJECT_KEY_TAKEN");
  });

  it("has nothing to wait for when the key is unchanged", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    const same = await client.projects.changeKey({
      workspaceId: workspace.id,
      projectId: created.id,
      key: "MOR",
    });

    expect(same.txid).toBeNull();
  });
});

describe("ordering projects", () => {
  async function threeProjects() {
    const context = await setup();
    const { client, workspace } = context;
    const ids = [];
    for (const key of ["ONE", "TWO", "THR"]) {
      ids.push(
        (
          await client.projects.create({
            workspaceId: workspace.id,
            name: key,
            key,
          })
        ).id,
      );
    }
    return { ...context, ids };
  }

  it("stores the position the client chose", async () => {
    const { client, workspace, ids } = await threeProjects();

    const { txid } = await client.projects.reorder({
      workspaceId: workspace.id,
      projectId: ids[2]!,
      position: "Zz",
    });

    expect(txid).toBe(await xminOf(ids[2]!));
    const listed = await client.projects.list({ workspaceId: workspace.id });
    expect(listed.map((project) => project.key)).toEqual(["THR", "ONE", "TWO"]);
  });

  it("sorts positions by bytes in the database, not by the locale", async () => {
    const { client, workspace, ids } = await threeProjects();
    await client.projects.reorder({
      workspaceId: workspace.id,
      projectId: ids[2]!,
      position: "Zz",
    });

    const rows = await db.execute<{ key: string }>(
      sql`SELECT key FROM project WHERE workspace_id = ${workspace.id} ORDER BY position`,
    );

    // A locale-aware collation would put "Zz" after "a0" and "a1".
    expect(rows.rows.map((row) => row.key)).toEqual(["THR", "ONE", "TWO"]);
  });

  it("refuses a position that is not a fractional-index key", async () => {
    const { client, workspace, ids } = await threeProjects();

    const error = await rejection(
      client.projects.reorder({
        workspaceId: workspace.id,
        projectId: ids[0]!,
        position: "not a key",
      }),
    );

    expect(error.data?.code).toBe("INVALID_POSITION");
  });

  it("refuses a position another project already holds", async () => {
    const { client, workspace, ids } = await threeProjects();
    const [other] = await db
      .select({ position: schema.projectTable.position })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, ids[1]!));

    const error = await rejection(
      client.projects.reorder({
        workspaceId: workspace.id,
        projectId: ids[0]!,
        position: other!.position,
      }),
    );

    expect(error.data?.code).toBe("POSITION_TAKEN");
    const listed = await client.projects.list({ workspaceId: workspace.id });
    expect(listed.map((project) => project.key)).toEqual(["ONE", "TWO", "THR"]);
  });
});

describe("archiving a project", () => {
  async function archived() {
    const context = await setup();
    const { client, workspace } = context;
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });
    const { txid } = await client.projects.archive({
      workspaceId: workspace.id,
      projectId: created.id,
    });
    return { ...context, projectId: created.id, txid };
  }

  it("keeps the project in the list, marked archived", async () => {
    const { client, workspace, projectId, txid } = await archived();

    expect(txid).toBe(await xminOf(projectId));
    const [listed] = await client.projects.list({ workspaceId: workspace.id });
    expect(listed?.archivedAt).toBeInstanceOf(Date);
    expect(listed?.columns).toHaveLength(5);
  });

  it("refuses every change except unarchive and delete", async () => {
    const { client, workspace, projectId } = await archived();
    const base = { workspaceId: workspace.id, projectId };
    const [column] = await columnsOf(projectId);

    const attempts = [
      () => client.projects.update({ ...base, name: "Nope" }),
      () => client.projects.changeKey({ ...base, key: "NOP" }),
      () => client.projects.reorder({ ...base, position: "Zz" }),
      () => client.projects.archive(base),
      () =>
        client.projects.columns.create({
          ...base,
          name: "Nope",
          category: "started",
        }),
      () =>
        client.projects.columns.update({
          ...base,
          columnId: column!.id,
          name: "Nope",
        }),
    ];
    for (const attempt of attempts) {
      expect((await rejection(attempt())).data?.code).toBe("PROJECT_ARCHIVED");
    }
  });

  it("can be undone", async () => {
    const { client, workspace, projectId } = await archived();

    await client.projects.unarchive({ workspaceId: workspace.id, projectId });

    const [listed] = await client.projects.list({ workspaceId: workspace.id });
    expect(listed?.archivedAt).toBeNull();
    await client.projects.update({
      workspaceId: workspace.id,
      projectId,
      name: "Writable again",
    });
  });

  it("refuses to unarchive a project that is not archived", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    const error = await rejection(
      client.projects.unarchive({
        workspaceId: workspace.id,
        projectId: created.id,
      }),
    );

    expect(error.data?.code).toBe("PROJECT_NOT_ARCHIVED");
  });

  it("deletes an active project without archiving it first", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });

    await client.projects.remove({
      workspaceId: workspace.id,
      projectId: created.id,
    });

    expect(await client.projects.list({ workspaceId: workspace.id })).toEqual(
      [],
    );
  });

  it("deletes the project and its columns for good", async () => {
    const { client, workspace, projectId } = await archived();

    await client.projects.remove({ workspaceId: workspace.id, projectId });

    expect(await client.projects.list({ workspaceId: workspace.id })).toEqual(
      [],
    );
    expect(await columnsOf(projectId)).toEqual([]);
  });
});

describe("project activity", () => {
  async function activityTypes(workspaceId: string) {
    const rows = await db
      .select({ type: schema.activityTable.type })
      .from(schema.activityTable)
      .where(eq(schema.activityTable.workspaceId, workspaceId))
      .orderBy(schema.activityTable.createdAt);
    return rows.map((row) => row.type);
  }

  it("records the project lifecycle and the key change", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "OLD",
    });
    const base = { workspaceId: workspace.id, projectId: created.id };

    await client.projects.changeKey({ ...base, key: "MOR" });
    await client.projects.archive(base);
    await client.projects.unarchive(base);
    await client.projects.archive(base);
    await client.projects.remove(base);

    expect(await activityTypes(workspace.id)).toEqual([
      "project.created",
      "project.key_changed",
      "project.archived",
      "project.unarchived",
      "project.archived",
      "project.deleted",
    ]);
  });

  it("names the old and new key and the project", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "OLD",
    });
    await client.projects.changeKey({
      workspaceId: workspace.id,
      projectId: created.id,
      key: "MOR",
    });

    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.workspaceId, workspace.id),
          eq(schema.activityTable.type, "project.key_changed"),
        ),
      );

    expect(rows[0]).toMatchObject({
      resourceType: "project",
      resourceId: created.id,
      eventData: { previousKey: "OLD", projectKey: "MOR" },
    });
  });

  it("leaves renames, reorders and column edits out of the feed", async () => {
    const { client, workspace } = await setup();
    const created = await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
    });
    const base = { workspaceId: workspace.id, projectId: created.id };
    const [column] = await columnsOf(created.id);

    await client.projects.update({ ...base, name: "Renamed" });
    await client.projects.reorder({ ...base, position: "a0V" });
    await client.projects.columns.create({
      ...base,
      name: "Review",
      category: "started",
    });
    await client.projects.columns.update({
      ...base,
      columnId: column!.id,
      color: "pink",
    });

    expect(await activityTypes(workspace.id)).toEqual(["project.created"]);
  });
});
