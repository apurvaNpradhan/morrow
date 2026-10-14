import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  as,
  columnsOf,
  createProject,
  rejection,
  setupWorkspace,
} from "./helpers/projects";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

/** A workspace with one project; columns by name for readable tests. */
async function setup() {
  const context = await setupWorkspace();
  const project = await createProject(context.client, context.workspace.id);
  const columns = await columnsOf(project.id);
  const byName = (name: string) => {
    const column = columns.find((candidate) => candidate.name === name);
    if (!column) throw new Error(`No column ${name}`);
    return column;
  };
  return {
    ...context,
    projectId: project.id,
    base: { workspaceId: context.workspace.id, projectId: project.id },
    byName,
  };
}

async function namesIn(projectId: string) {
  return (await columnsOf(projectId)).map(
    (column) => `${column.category}:${column.name}`,
  );
}

describe("adding a column", () => {
  it("puts it at the end of its category with the category's default colour", async () => {
    const { client, base, projectId } = await setup();

    await client.projects.columns.create({
      ...base,
      name: "In Review",
      category: "started",
    });

    expect(await namesIn(projectId)).toEqual([
      "backlog:Backlog",
      "unstarted:To Do",
      "started:In Progress",
      "started:In Review",
      "done:Done",
      "canceled:Canceled",
    ]);
    const added = (await columnsOf(projectId)).find(
      (column) => column.name === "In Review",
    );
    expect(added?.color).toBe("blue");
  });

  it("takes a colour from the palette and refuses anything else", async () => {
    const { client, base, projectId } = await setup();

    await client.projects.columns.create({
      ...base,
      name: "Blocked",
      category: "started",
      color: "orange",
    });
    const error = await rejection(
      client.projects.columns.create({
        ...base,
        name: "Odd",
        category: "started",
        color: "#ff0000" as never,
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    const blocked = (await columnsOf(projectId)).find(
      (column) => column.name === "Blocked",
    );
    expect(blocked?.color).toBe("orange");
  });

  it("refuses an unknown category", async () => {
    const { client, base } = await setup();

    const error = await rejection(
      client.projects.columns.create({
        ...base,
        name: "Odd",
        category: "paused" as never,
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });

  it("refuses a name the project already uses, whatever its case", async () => {
    const { client, base } = await setup();

    const error = await rejection(
      client.projects.columns.create({
        ...base,
        name: "in progress",
        category: "started",
      }),
    );

    expect(error.data?.code).toBe("COLUMN_NAME_TAKEN");
  });

  it("allows a name another project uses", async () => {
    const { client, workspace } = await setup();
    const other = await createProject(client, workspace.id, "OTH");

    const created = await client.projects.columns.create({
      workspaceId: workspace.id,
      projectId: other.id,
      name: "Backlog 2",
      category: "backlog",
    });
    const same = await client.projects.columns.create({
      workspaceId: workspace.id,
      projectId: other.id,
      name: "Waiting",
      category: "started",
    });

    expect(created.id).not.toBe(same.id);
  });
});

describe("editing a column", () => {
  it("renames it and changes its colour", async () => {
    const { client, base, byName } = await setup();
    const column = byName("In Progress");

    const { txid } = await client.projects.columns.update({
      ...base,
      columnId: column.id,
      name: "Doing",
      color: "violet",
    });

    const [row] = await db
      .select()
      .from(schema.projectColumnTable)
      .where(eq(schema.projectColumnTable.id, column.id));
    expect(row).toMatchObject({ name: "Doing", color: "violet" });
    expect(txid).toBeGreaterThan(0);
  });

  it("refuses a rename onto another column's name", async () => {
    const { client, base, byName } = await setup();

    const error = await rejection(
      client.projects.columns.update({
        ...base,
        columnId: byName("In Progress").id,
        name: "DONE",
      }),
    );

    expect(error.data?.code).toBe("COLUMN_NAME_TAKEN");
  });

  it("refuses an update that changes nothing", async () => {
    const { client, base, byName } = await setup();

    const error = await rejection(
      client.projects.columns.update({
        ...base,
        columnId: byName("Done").id,
      }),
    );

    expect(error.code).toBe("BAD_REQUEST");
  });

  it("does not reach a column of another project", async () => {
    const { client, workspace, byName } = await setup();
    const other = await createProject(client, workspace.id, "OTH");

    const error = await rejection(
      client.projects.columns.update({
        workspaceId: workspace.id,
        projectId: other.id,
        columnId: byName("Done").id,
        name: "Hijacked",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("does not reach a project of another workspace", async () => {
    const { projectId, byName } = await setup();
    const { user: stranger, workspace: elsewhere } =
      await createWorkspaceMember({ role: "owner" });

    const error = await rejection(
      as(stranger).projects.columns.update({
        workspaceId: elsewhere.id,
        projectId,
        columnId: byName("Done").id,
        name: "Hijacked",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("moving a column", () => {
  async function withReview() {
    const context = await setup();
    await context.client.projects.columns.create({
      ...context.base,
      name: "In Review",
      category: "started",
    });
    return context;
  }

  it("reorders within a category", async () => {
    const { client, base, projectId } = await withReview();
    const columns = await columnsOf(projectId);
    const review = columns.find((column) => column.name === "In Review")!;

    await client.projects.columns.move({
      ...base,
      columnId: review.id,
      category: "started",
      position: "Zz",
    });

    expect(await namesIn(projectId)).toEqual([
      "backlog:Backlog",
      "unstarted:To Do",
      "started:In Review",
      "started:In Progress",
      "done:Done",
      "canceled:Canceled",
    ]);
  });

  it("moves a column into another category's group", async () => {
    const { client, base, projectId } = await withReview();
    const review = (await columnsOf(projectId)).find(
      (column) => column.name === "In Review",
    )!;

    await client.projects.columns.move({
      ...base,
      columnId: review.id,
      category: "unstarted",
      position: "a1",
    });

    expect(await namesIn(projectId)).toEqual([
      "backlog:Backlog",
      "unstarted:To Do",
      "unstarted:In Review",
      "started:In Progress",
      "done:Done",
      "canceled:Canceled",
    ]);
  });

  it("refuses a malformed position", async () => {
    const { client, base, byName } = await setup();

    const error = await rejection(
      client.projects.columns.move({
        ...base,
        columnId: byName("Backlog").id,
        category: "backlog",
        position: "??",
      }),
    );

    expect(error.data?.code).toBe("INVALID_POSITION");
  });

  it("refuses a position another column of the category holds", async () => {
    const { client, base, projectId } = await withReview();
    const columns = await columnsOf(projectId);
    const review = columns.find((column) => column.name === "In Review")!;
    const progress = columns.find((column) => column.name === "In Progress")!;

    const error = await rejection(
      client.projects.columns.move({
        ...base,
        columnId: review.id,
        category: "started",
        position: progress.position,
      }),
    );

    expect(error.data?.code).toBe("POSITION_TAKEN");
  });

  it("keeps the last unstarted and the last done column where they are", async () => {
    const { client, base, byName } = await setup();

    for (const name of ["To Do", "Done"]) {
      const error = await rejection(
        client.projects.columns.move({
          ...base,
          columnId: byName(name).id,
          category: "started",
          position: "a5",
        }),
      );
      expect(error.data?.code).toBe("LAST_REQUIRED_COLUMN");
    }
  });

  it("lets the last backlog or started column change category", async () => {
    const { client, base, projectId, byName } = await setup();

    await client.projects.columns.move({
      ...base,
      columnId: byName("Backlog").id,
      category: "unstarted",
      position: "a1",
    });
    await client.projects.columns.move({
      ...base,
      columnId: byName("In Progress").id,
      category: "unstarted",
      position: "a2",
    });

    expect((await namesIn(projectId)).slice(0, 3)).toEqual([
      "unstarted:To Do",
      "unstarted:Backlog",
      "unstarted:In Progress",
    ]);
  });

  it("lets an unstarted column leave when another one remains", async () => {
    const { client, base, byName } = await setup();
    const extra = await client.projects.columns.create({
      ...base,
      name: "Ready",
      category: "unstarted",
    });

    await client.projects.columns.move({
      ...base,
      columnId: extra.id,
      category: "started",
      position: "a5",
    });
    const error = await rejection(
      client.projects.columns.move({
        ...base,
        columnId: byName("To Do").id,
        category: "started",
        position: "a6",
      }),
    );

    expect(error.data?.code).toBe("LAST_REQUIRED_COLUMN");
  });
});

describe("deleting a column", () => {
  it("removes it when another column is named as the target", async () => {
    const { client, base, projectId, byName } = await setup();

    const { txid } = await client.projects.columns.remove({
      ...base,
      columnId: byName("In Progress").id,
      targetColumnId: byName("To Do").id,
    });

    expect(txid).toBeGreaterThan(0);
    expect(await namesIn(projectId)).toEqual([
      "backlog:Backlog",
      "unstarted:To Do",
      "done:Done",
      "canceled:Canceled",
    ]);
  });

  it("refuses to delete the last unstarted or done column", async () => {
    const { client, base, projectId, byName } = await setup();

    for (const name of ["To Do", "Done"]) {
      const error = await rejection(
        client.projects.columns.remove({
          ...base,
          columnId: byName(name).id,
          targetColumnId: byName("Backlog").id,
        }),
      );
      expect(error.data?.code).toBe("LAST_REQUIRED_COLUMN");
    }
    expect(await columnsOf(projectId)).toHaveLength(5);
  });

  it("deletes a required column once another of its category exists", async () => {
    const { client, base, byName } = await setup();
    const spare = await client.projects.columns.create({
      ...base,
      name: "Shipped",
      category: "done",
    });

    await client.projects.columns.remove({
      ...base,
      columnId: byName("Done").id,
      targetColumnId: spare.id,
    });

    const error = await rejection(
      client.projects.columns.remove({
        ...base,
        columnId: spare.id,
        targetColumnId: byName("Backlog").id,
      }),
    );
    expect(error.data?.code).toBe("LAST_REQUIRED_COLUMN");
  });

  it("needs a target that is another column of the same project", async () => {
    const { client, base, workspace, byName } = await setup();
    const other = await createProject(client, workspace.id, "OTH");
    const foreign = (await columnsOf(other.id))[0]!;
    const column = byName("In Progress");

    for (const targetColumnId of [column.id, foreign.id, "no-such-column"]) {
      const error = await rejection(
        client.projects.columns.remove({
          ...base,
          columnId: column.id,
          targetColumnId,
        }),
      );
      expect(error.data?.code).toBe("INVALID_TARGET_COLUMN");
    }
  });
});

describe("who may edit columns", () => {
  it("lets a member edit, and a viewer only look", async () => {
    const { base, workspace } = await setup();
    const member = await addWorkspaceMember(workspace.id, "member");
    const viewer = await addWorkspaceMember(workspace.id, "viewer");

    await as(member).projects.columns.create({
      ...base,
      name: "Review",
      category: "started",
    });
    const error = await rejection(
      as(viewer).projects.columns.create({
        ...base,
        name: "Nope",
        category: "started",
      }),
    );

    expect(error.code).toBe("FORBIDDEN");
  });
});
