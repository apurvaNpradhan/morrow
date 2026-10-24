import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { addField, fieldRow, fieldRows } from "./helpers/fields";
import { ageEvents, eventsOf, storyOf } from "./helpers/history";
import { as, createProject, rejection } from "./helpers/projects";
import { setupTasks, taskRow, xminOfTask } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const size = await addField(context, "Size", ["Small", "Large"]);
  const customer = await addField(context, "Customer", ["Acme"]);
  const task = await context.addTask("To Do", { title: "Sized" });
  const other = await context.addTask("To Do", { title: "Other" });
  const target = (taskId: string) => ({ ...context.base, taskId });
  const setValue = (
    taskId: string,
    field: { id: string },
    value: unknown,
    client = context.client,
  ) =>
    client.tasks.setFieldValue({
      ...target(taskId),
      fieldId: field.id,
      value: value as string | null,
    });
  return { ...context, size, customer, task, other, target, setValue };
}

describe("defining Fields and options", () => {
  it("adds a Field at the end, with options that get the next palette colours", async () => {
    const { projectId, size, customer } = await setup();

    const rows = (await fieldRows(projectId)).sort((a, b) =>
      a.position < b.position ? -1 : 1,
    );
    const options = (await fieldRow(size.id))?.options ?? [];

    expect(rows.map((row) => row.name)).toEqual(["Size", "Customer"]);
    expect(rows[0]).toMatchObject({ type: "single_choice" });
    expect(options.map((option) => option.name)).toEqual(["Small", "Large"]);
    expect(new Set(options.map((option) => option.color)).size).toBe(2);
    expect(customer.id).not.toBe(size.id);
  });

  it("renames, recolours and reorders without writing any Task", async () => {
    const { client, base, size, task, setValue } = await setup();
    await setValue(task.id, size, size.options.Large);
    const before = await xminOfTask(task.id);

    await client.projects.fields.update({
      ...base,
      fieldId: size.id,
      name: "T-shirt",
    });
    await client.projects.fields.options.update({
      ...base,
      fieldId: size.id,
      optionId: size.options.Large!,
      name: "XL",
      color: "#3b82f6",
    });
    await client.projects.fields.options.move({
      ...base,
      fieldId: size.id,
      optionId: size.options.Large!,
      position: "Zz",
    });

    expect(await xminOfTask(task.id)).toBe(before);
    expect((await taskRow(task.id))?.fieldValues).toEqual({
      [size.id]: size.options.Large,
    });
    const row = await fieldRow(size.id);
    expect(row?.name).toBe("T-shirt");
    expect(row?.options.find((o) => o.id === size.options.Large)).toMatchObject(
      { name: "XL", color: "#3b82f6", position: "Zz" },
    );
  });

  it("refuses names that collide ignoring case, in a Field's options or among Fields", async () => {
    const { client, base, size } = await setup();

    const field = await rejection(
      client.projects.fields.create({ ...base, name: "  sIZE " }),
    );
    const rename = await rejection(
      client.projects.fields.update({
        ...base,
        fieldId: size.id,
        name: "customer",
      }),
    );
    const option = await rejection(
      client.projects.fields.options.create({
        ...base,
        fieldId: size.id,
        name: "LARGE",
      }),
    );
    const renameOption = await rejection(
      client.projects.fields.options.update({
        ...base,
        fieldId: size.id,
        optionId: size.options.Small!,
        name: "large",
      }),
    );

    expect(field.data?.code).toBe("FIELD_NAME_TAKEN");
    expect(rename.data?.code).toBe("FIELD_NAME_TAKEN");
    expect(option.data?.code).toBe("OPTION_NAME_TAKEN");
    expect(renameOption.data?.code).toBe("OPTION_NAME_TAKEN");
  });

  it("refuses empty and over-long names, and a 21st Field or 51st option", async () => {
    const { client, base, size } = await setup();

    const empty = await rejection(
      client.projects.fields.create({ ...base, name: "   " }),
    );
    const long = await rejection(
      client.projects.fields.create({ ...base, name: "x".repeat(51) }),
    );
    for (let at = 3; at <= 20; at += 1) {
      await client.projects.fields.create({ ...base, name: `F${at}` });
    }
    const field21 = await rejection(
      client.projects.fields.create({ ...base, name: "F21" }),
    );
    for (let at = 3; at <= 50; at += 1) {
      await client.projects.fields.options.create({
        ...base,
        fieldId: size.id,
        name: `O${at}`,
      });
    }
    const option51 = await rejection(
      client.projects.fields.options.create({
        ...base,
        fieldId: size.id,
        name: "O51",
      }),
    );

    expect(empty.code).toBe("BAD_REQUEST");
    expect(long.code).toBe("BAD_REQUEST");
    expect(field21.data?.code).toBe("FIELD_LIMIT_REACHED");
    expect(option51.data?.code).toBe("OPTION_LIMIT_REACHED");
  });

  it("does not reach a Field of another Project", async () => {
    const { client, workspace, size } = await setup();
    const elsewhere = await createProject(client, workspace.id, "OTH");

    const attempt = await rejection(
      client.projects.fields.update({
        workspaceId: workspace.id,
        projectId: elsewhere.id,
        fieldId: size.id,
        name: "Hijacked",
      }),
    );

    expect(attempt.code).toBe("NOT_FOUND");
    expect((await fieldRow(size.id))?.name).toBe("Size");
  });
});

describe("setting a value", () => {
  it("stores the option id under the Field id, clears it with null, and returns the txid", async () => {
    const { task, size, customer, setValue } = await setup();

    await setValue(task.id, size, size.options.Small);
    const last = await setValue(task.id, customer, customer.options.Acme);

    expect(last.txid).toBe(await xminOfTask(task.id));
    expect((await taskRow(task.id))?.fieldValues).toEqual({
      [size.id]: size.options.Small,
      [customer.id]: customer.options.Acme,
    });

    await setValue(task.id, size, null);

    expect((await taskRow(task.id))?.fieldValues).toEqual({
      [customer.id]: customer.options.Acme,
    });
  });

  it("still returns a txid that sync can see when nothing changed", async () => {
    const { task, size, setValue } = await setup();

    const cleared = await setValue(task.id, size, null);

    expect(cleared.txid).toBe(await xminOfTask(task.id));
  });

  it("refuses an unknown option, another Field's option, the wrong type and a Field of another Project", async () => {
    const { client, workspace, task, size, customer, setValue } = await setup();
    const elsewhere = await createProject(client, workspace.id, "OTH");
    const foreign = await addField(
      { client, base: { workspaceId: workspace.id, projectId: elsewhere.id } },
      "Foreign",
      ["Nope"],
    );

    const unknown = await rejection(setValue(task.id, size, "nope"));
    const crossed = await rejection(
      setValue(task.id, size, customer.options.Acme),
    );
    const number = await rejection(setValue(task.id, size, 3));
    const list = await rejection(setValue(task.id, size, [size.options.Small]));
    const otherProject = await rejection(
      setValue(task.id, foreign, foreign.options.Nope),
    );

    expect(unknown.data?.code).toBe("INVALID_FIELD_VALUE");
    expect(crossed.data?.code).toBe("INVALID_FIELD_VALUE");
    expect(number.data?.code).toBe("INVALID_FIELD_VALUE");
    expect(list.data?.code).toBe("INVALID_FIELD_VALUE");
    expect(otherProject.code).toBe("NOT_FOUND");
    expect((await taskRow(task.id))?.fieldValues).toEqual({});
  });

  it("can be given when a task is created, checked like any other value", async () => {
    const { client, base, byName, nextPosition, size } = await setup();
    const column = byName("To Do");
    const create = (fieldValues: Record<string, string>) =>
      client.tasks.create({
        ...base,
        id: `t${Math.random().toString(16).slice(2).padEnd(23, "0").slice(0, 23)}`,
        columnId: column.id,
        position: nextPosition(column.id),
        title: "With size",
        fieldValues,
      });

    const created = await create({ [size.id]: size.options.Large! });
    const bad = await rejection(create({ [size.id]: "nope" }));
    const gone = await rejection(create({ missing: size.options.Large! }));

    expect((await taskRow(created.id))?.fieldValues).toEqual({
      [size.id]: size.options.Large,
    });
    expect(bad.data?.code).toBe("INVALID_FIELD_VALUE");
    expect(gone.code).toBe("NOT_FOUND");
  });

  it("copies the values when a task is duplicated", async () => {
    const { client, base, task, size, setValue } = await setup();
    await setValue(task.id, size, size.options.Large);
    const copyId = `c${"0".repeat(23)}`;

    await client.tasks.duplicate({
      ...base,
      taskId: task.id,
      id: copyId,
      position: "aZ",
    });

    expect((await taskRow(copyId))?.fieldValues).toEqual({
      [size.id]: size.options.Large,
    });
  });
});

describe("deleting an option or a Field", () => {
  it("removes the option's id from every Task of the Project that holds it, in the same transaction", async () => {
    const { client, base, task, other, size, customer, setValue } =
      await setup();
    await setValue(task.id, size, size.options.Large);
    await setValue(other.id, size, size.options.Small);
    await setValue(task.id, customer, customer.options.Acme);

    const { txid } = await client.projects.fields.options.remove({
      ...base,
      fieldId: size.id,
      optionId: size.options.Large!,
    });

    expect((await taskRow(task.id))?.fieldValues).toEqual({
      [customer.id]: customer.options.Acme,
    });
    expect((await taskRow(other.id))?.fieldValues).toEqual({
      [size.id]: size.options.Small,
    });
    expect(txid).toBe(await xminOfTask(task.id));
    expect((await fieldRow(size.id))?.options.map((o) => o.name)).toEqual([
      "Small",
    ]);
  });

  it("removes the Field's key from every Task and deletes the Field, in the same transaction", async () => {
    const { client, base, task, other, size, customer, setValue } =
      await setup();
    await setValue(task.id, size, size.options.Large);
    await setValue(other.id, size, size.options.Small);
    await setValue(other.id, customer, customer.options.Acme);

    const { txid } = await client.projects.fields.remove({
      ...base,
      fieldId: size.id,
    });

    expect((await taskRow(task.id))?.fieldValues).toEqual({});
    expect((await taskRow(other.id))?.fieldValues).toEqual({
      [customer.id]: customer.options.Acme,
    });
    expect(txid).toBe(await xminOfTask(task.id));
    expect(await fieldRow(size.id)).toBeUndefined();
  });

  it("counts the Tasks holding each value, for the confirmation", async () => {
    const { client, base, task, other, size, setValue } = await setup();
    await setValue(task.id, size, size.options.Large);
    await setValue(other.id, size, size.options.Large);

    const usage = await client.projects.fields.usage(base);

    expect(usage).toEqual(
      expect.arrayContaining([
        { fieldId: size.id, optionId: null, count: 2 },
        { fieldId: size.id, optionId: size.options.Large, count: 2 },
      ]),
    );
    expect(usage).toHaveLength(2);
  });

  it("never leaves a dangling key when a value write races a Field delete", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { client, base, task, size, setValue } = await setup();

      const [write] = await Promise.allSettled([
        setValue(task.id, size, size.options.Large),
        client.projects.fields.remove({ ...base, fieldId: size.id }),
      ]);

      expect(await fieldRow(size.id)).toBeUndefined();
      expect((await taskRow(task.id))?.fieldValues).toEqual({});
      expect(["fulfilled", "rejected"]).toContain(write.status);
      await resetTestDatabase();
    }
  });

  it("never leaves a dangling id when a value write races an option delete", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { client, base, task, size, setValue } = await setup();

      await Promise.allSettled([
        setValue(task.id, size, size.options.Large),
        client.projects.fields.options.remove({
          ...base,
          fieldId: size.id,
          optionId: size.options.Large!,
        }),
      ]);

      expect((await taskRow(task.id))?.fieldValues).toEqual({});
      await resetTestDatabase();
    }
  });

  it("writes no task history for the cascade", async () => {
    const { client, base, task, size, setValue } = await setup();
    await setValue(task.id, size, size.options.Large);
    await ageEvents(task.id, 60);
    const before = await eventsOf(task.id);

    await client.projects.fields.options.remove({
      ...base,
      fieldId: size.id,
      optionId: size.options.Large!,
    });
    await client.projects.fields.remove({ ...base, fieldId: size.id });

    expect((await eventsOf(task.id)).map((e) => e.id)).toEqual(
      before.map((e) => e.id),
    );
  });
});

describe("permissions", () => {
  it("refuses a Viewer every value write and every definition", async () => {
    const { workspace, base, task, size } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const attempts = [
      () =>
        viewer.tasks.setFieldValue({
          ...base,
          taskId: task.id,
          fieldId: size.id,
          value: size.options.Small!,
        }),
      () => viewer.projects.fields.create({ ...base, name: "New" }),
      () =>
        viewer.projects.fields.options.create({
          ...base,
          fieldId: size.id,
          name: "Medium",
        }),
      () => viewer.projects.fields.remove({ ...base, fieldId: size.id }),
    ];

    for (const attempt of attempts) {
      expect((await rejection(attempt())).code).toBe("FORBIDDEN");
    }
    expect((await taskRow(task.id))?.fieldValues).toEqual({});
  });

  it("needs project: update to define Fields but only task: update to set a value", async () => {
    const { workspace, base, task, size } = await setup();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "editor",
      permission: JSON.stringify({
        workspace: ["read"],
        task: ["create", "update"],
        project: [],
      }),
    });
    const editor = as(await addWorkspaceMember(workspace.id, "editor"));

    const define = await rejection(
      editor.projects.fields.create({ ...base, name: "New" }),
    );
    const set = await editor.tasks.setFieldValue({
      ...base,
      taskId: task.id,
      fieldId: size.id,
      value: size.options.Small!,
    });

    expect(define.code).toBe("FORBIDDEN");
    expect(set.txid).toBeGreaterThan(0);
  });

  it("refuses both definitions and values in an archived Project", async () => {
    const { client, base, task, size } = await setup();
    await client.projects.archive(base);

    const define = await rejection(
      client.projects.fields.create({ ...base, name: "New" }),
    );
    const set = await rejection(
      client.tasks.setFieldValue({
        ...base,
        taskId: task.id,
        fieldId: size.id,
        value: size.options.Small!,
      }),
    );

    expect(define.data?.code).toBe("PROJECT_ARCHIVED");
    expect(set.data?.code).toBe("PROJECT_ARCHIVED");
  });
});

describe("history", () => {
  const change = (
    story: { type: string; data: unknown }[],
  ): { from?: string; to?: string }[] =>
    story.flatMap((event) => {
      if (event.type !== "field_changed") return [];
      const { from, to } = event.data as {
        from: { name: string } | null;
        to: { name: string } | null;
      };
      return [{ from: from?.name, to: to?.name }];
    });

  it("records the Field and option names, and folds repeated changes within ten minutes", async () => {
    const { task, size, setValue } = await setup();

    await setValue(task.id, size, size.options.Small);
    await setValue(task.id, size, size.options.Large);

    expect(await storyOf(task.id)).toContainEqual({
      type: "field_changed",
      data: {
        field: { id: size.id, name: "Size" },
        from: null,
        to: {
          id: size.options.Large,
          name: "Large",
          color: expect.stringMatching(/^#[0-9a-f]{6}$/),
        },
      },
    });
    expect(change(await storyOf(task.id))).toHaveLength(1);
  });

  it("leaves no event when the value returns to where it began", async () => {
    const { task, size, setValue } = await setup();

    await setValue(task.id, size, size.options.Small);
    await setValue(task.id, size, null);

    expect(change(await storyOf(task.id))).toEqual([]);
  });

  it("starts a new entry after the window, and again after another Field", async () => {
    const { task, size, customer, setValue } = await setup();

    await setValue(task.id, size, size.options.Small);
    await ageEvents(task.id, 11);
    await setValue(task.id, size, size.options.Large);
    await setValue(task.id, customer, customer.options.Acme);

    expect(change(await storyOf(task.id))).toEqual([
      { from: undefined, to: "Small" },
      { from: "Small", to: "Large" },
      { from: undefined, to: "Acme" },
    ]);
  });

  it("does not record a set to the value the Task already has", async () => {
    const { task, size, setValue } = await setup();
    await setValue(task.id, size, size.options.Small);
    await ageEvents(task.id, 11);

    await setValue(task.id, size, size.options.Small);

    expect(change(await storyOf(task.id))).toHaveLength(1);
  });
});

describe("exporting and importing Fields", () => {
  it("exports Fields, options and each Task's values by name", async () => {
    const { client, base, task, size, setValue } = await setup();
    await setValue(task.id, size, size.options.Large);

    const document = await client.tasks.export(base);

    expect(document.fields).toEqual([
      {
        name: "Size",
        type: "single_choice",
        config: {},
        options: [
          { name: "Small", color: expect.any(String) },
          { name: "Large", color: expect.any(String) },
        ],
      },
      {
        name: "Customer",
        type: "single_choice",
        config: {},
        options: [{ name: "Acme", color: expect.any(String) }],
      },
    ]);
    expect(document.tasks.find((t) => t.title === "Sized")?.fields).toEqual({
      Size: "Large",
    });
  });

  it("matches by name ignoring case and creates what is missing for someone who may define Fields", async () => {
    const { client, workspace, size } = await setup();
    const into = await createProject(client, workspace.id, "DST");
    const base = { workspaceId: workspace.id, projectId: into.id };
    await addField({ client, base }, "size", ["Small"]);

    const result = await client.tasks.import({
      ...base,
      document: {
        fields: [
          { name: "Size", options: [{ name: "Huge", color: "#ef4444" }] },
        ],
        tasks: [
          { title: "A", column: "To Do", fields: { SIZE: "small" } },
          {
            title: "B",
            column: "To Do",
            fields: { Size: "Huge", Mood: "Calm" },
          },
        ],
      },
    });

    const fields = await fieldRows(into.id);
    const sizeField = fields.find((f) => f.name === "size");
    const mood = fields.find((f) => f.name === "Mood");
    const rows = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, into.id))
      .orderBy(schema.taskTable.number);
    expect(result.warnings).toEqual([]);
    expect(sizeField?.options.map((o) => [o.name, o.color])).toEqual([
      ["Small", expect.any(String)],
      ["Huge", "#ef4444"],
    ]);
    expect(mood?.options.map((o) => o.name)).toEqual(["Calm"]);
    expect(rows[0]?.fieldValues).toEqual({
      [sizeField!.id]: sizeField!.options[0]!.id,
    });
    expect(rows[1]?.fieldValues).toEqual({
      [sizeField!.id]: sizeField!.options[1]!.id,
      [mood!.id]: mood!.options[0]!.id,
    });
    expect(size.id).not.toBe(sizeField?.id);
  });

  it("drops what it cannot match with a warning when the importer may not define Fields", async () => {
    const { workspace, projectId, base, size, task, setValue } = await setup();
    await setValue(task.id, size, size.options.Small);
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "importer",
      permission: JSON.stringify({
        workspace: ["read"],
        task: ["create"],
        project: [],
      }),
    });
    const importer = as(await addWorkspaceMember(workspace.id, "importer"));

    const result = await importer.tasks.import({
      ...base,
      document: {
        tasks: [
          {
            title: "A",
            column: "To Do",
            fields: { Size: "Small", Mood: "Calm" },
          },
          { title: "B", column: "To Do", fields: { Size: "Gigantic" } },
          { title: "C", column: "To Do", fields: { Size: "Gigantic" } },
        ],
      },
    });

    expect(result.created).toBe(3);
    expect(result.warnings).toEqual([
      { kind: "field_dropped", field: "Mood", count: 1 },
      { kind: "option_dropped", field: "Size", option: "Gigantic", count: 2 },
    ]);
    expect((await fieldRows(projectId)).map((f) => f.name).sort()).toEqual([
      "Customer",
      "Size",
    ]);
    const imported = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.title, "A"));
    expect(imported[0]?.fieldValues).toEqual({
      [size.id]: size.options.Small,
    });
  });
});

describe("importing Fields without permission to define them", () => {
  it("warns about a declared Field or option no Task uses, and about names too long to keep", async () => {
    const { workspace, base } = await setup();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "importer",
      permission: JSON.stringify({
        workspace: ["read"],
        task: ["create"],
        project: [],
      }),
    });
    const importer = as(await addWorkspaceMember(workspace.id, "importer"));

    const result = await importer.tasks.import({
      ...base,
      document: {
        fields: [
          { name: "Mood", options: [{ name: "Calm" }] },
          { name: "size", options: [{ name: "Gigantic" }, { name: "Small" }] },
          { name: "x".repeat(51), options: [] },
        ],
        tasks: [{ title: "A", column: "To Do", fields: { SIZE: "gigantic" } }],
      },
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        { kind: "field_dropped", field: "Mood", count: 0 },
        { kind: "field_dropped", field: "x".repeat(51), count: 0 },
        {
          kind: "option_dropped",
          field: "Size",
          option: "Gigantic",
          count: 1,
        },
      ]),
    );
    expect(result.warnings).toHaveLength(3);
  });
});

describe("the synced tables", () => {
  it("publishes project_field with full replica identity and an electric grant", async () => {
    const facts = await db.execute<{
      identity: string;
      published: boolean;
      granted: boolean;
    }>(sql`
      SELECT c.relreplident AS identity,
        EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'electric_publication_default' AND tablename = 'project_field') AS published,
        has_table_privilege('electric', 'project_field', 'SELECT') AS granted
      FROM pg_class c WHERE c.relname = 'project_field'`);

    expect(facts.rows[0]).toEqual({
      identity: "f",
      published: true,
      granted: true,
    });
  });
});
