import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import { addField, fieldRow } from "./helpers/fields";
import { storyOf } from "./helpers/history";
import { rejection } from "./helpers/projects";
import { newTaskId, positionAt, setupTasks, taskRow } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const areas = await addField(context, "Areas", ["API", "Web", "Docs"], {
    type: "multi_choice",
  });
  const note = await addField(context, "Note", [], { type: "text" });
  const link = await addField(context, "Spec", [], {
    type: "text",
    config: { format: "url" },
  });
  const points = await addField(context, "Points", [], {
    type: "number",
    config: { min: 0, max: 100, unit: "pts" },
  });
  const target = await addField(context, "Target", [], { type: "date" });
  const reviewed = await addField(context, "Reviewed", [], {
    type: "checkbox",
  });
  const task = await context.addTask("To Do", { title: "Typed" });
  const set = (field: { id: string }, value: unknown, taskId = task.id) =>
    context.client.tasks.setFieldValue({
      ...context.base,
      taskId,
      fieldId: field.id,
      value: value as never,
    });
  return { ...context, areas, note, link, points, target, reviewed, task, set };
}

const invalid = async (promise: Promise<unknown>) =>
  (await rejection(promise)).data?.code;

describe("defining Fields of each type", () => {
  it("stores the type and its config, and refuses a config the type does not allow", async () => {
    const { client, base, points, note } = await setup();

    expect((await fieldRow(points.id))?.config).toEqual({
      min: 0,
      max: 100,
      unit: "pts",
    });
    expect((await fieldRow(note.id))?.config).toEqual({});
    for (const [type, config] of [
      ["text", { format: "currency" }],
      ["number", { min: 5, max: 1 }],
      ["number", { format: "currency" }],
      ["number", { format: "currency", unit: "usd" }],
      ["number", { format: "percent", unit: "pts" }],
      ["date", { format: "plain" }],
      ["checkbox", { min: 1 }],
    ] as const) {
      expect(
        await invalid(
          client.projects.fields.create({
            ...base,
            name: `${type}${JSON.stringify(config)}`.slice(0, 50),
            type,
            config,
          }),
        ),
      ).toBe("INVALID_FIELD_CONFIG");
    }
  });

  it("accepts a currency with its ISO code and a percent", async () => {
    const ctx = await setup();
    const money = await addField(ctx, "Budget", [], {
      type: "number",
      config: { format: "currency", unit: "USD" },
    });
    const done = await addField(ctx, "Done", [], {
      type: "number",
      config: { format: "percent", min: 0, max: 100 },
    });

    expect((await fieldRow(money.id))?.config.unit).toBe("USD");
    expect((await fieldRow(done.id))?.config.format).toBe("percent");
  });

  it("updates a number's bounds and refuses options on a Field without any", async () => {
    const { client, base, points, note } = await setup();

    await client.projects.fields.update({
      ...base,
      fieldId: points.id,
      config: { min: 1, max: 5 },
    });
    expect((await fieldRow(points.id))?.config).toEqual({ min: 1, max: 5 });
    expect(
      await invalid(
        client.projects.fields.update({
          ...base,
          fieldId: points.id,
          config: { min: 9, max: 1 },
        }),
      ),
    ).toBe("INVALID_FIELD_CONFIG");
    expect(
      await invalid(
        client.projects.fields.options.create({
          ...base,
          fieldId: note.id,
          name: "Nope",
        }),
      ),
    ).toBe("FIELD_HAS_NO_OPTIONS");
  });
});

describe("setting values of each type", () => {
  it("stores each value as its own JSON type and clears it with null", async () => {
    const t = await setup();
    await t.set(t.areas, [t.areas.options.API, t.areas.options.Docs]);
    await t.set(t.note, "  call Ana  ");
    await t.set(t.link, "https://example.com/spec");
    await t.set(t.points, 3.5);
    await t.set(t.target, "2026-11-01");
    await t.set(t.reviewed, true);

    expect((await taskRow(t.task.id))?.fieldValues).toEqual({
      [t.areas.id]: [t.areas.options.API, t.areas.options.Docs],
      [t.note.id]: "call Ana",
      [t.link.id]: "https://example.com/spec",
      [t.points.id]: 3.5,
      [t.target.id]: "2026-11-01",
      [t.reviewed.id]: true,
    });

    await t.set(t.reviewed, null);
    await t.set(t.points, null);
    expect(Object.keys((await taskRow(t.task.id))?.fieldValues ?? {})).toEqual(
      expect.not.arrayContaining([t.reviewed.id, t.points.id]),
    );
  });

  it("refuses a value of the wrong type, outside the bounds or naming no option", async () => {
    const t = await setup();
    const bad: [{ id: string }, unknown][] = [
      [t.areas, []],
      [t.areas, "not-an-array"],
      [t.areas, [t.areas.options.API, t.areas.options.API]],
      [t.areas, ["nope"]],
      [t.note, ""],
      [t.note, 5],
      [t.note, "x".repeat(201)],
      [t.link, "ftp://example.com"],
      [t.link, "not a url"],
      [t.points, "3"],
      [t.points, 101],
      [t.points, -1],
      [t.points, Number.MAX_SAFE_INTEGER * 10],
      [t.target, "2026-02-30"],
      [t.target, "2026-11-01T00:00:00Z"],
      [t.target, 20261101],
      [t.reviewed, false],
      [t.reviewed, "true"],
    ];
    for (const [field, value] of bad) {
      expect(await invalid(t.set(field, value)), JSON.stringify(value)).toBe(
        "INVALID_FIELD_VALUE",
      );
    }
    expect((await taskRow(t.task.id))?.fieldValues).toEqual({});
  });

  it("takes mixed values when a Task is created and checks them all", async () => {
    const t = await setup();
    const created = await t.addTask("To Do", {
      title: "Born typed",
      fieldValues: { [t.points.id]: 8, [t.areas.id]: [t.areas.options.Web] },
    });
    expect((await taskRow(created.id))?.fieldValues).toEqual({
      [t.points.id]: 8,
      [t.areas.id]: [t.areas.options.Web],
    });
    expect(
      await invalid(
        t.addTask("To Do", { fieldValues: { [t.points.id]: 1000 } }),
      ),
    ).toBe("INVALID_FIELD_VALUE");
  });

  it("copies every kind of value to a duplicate", async () => {
    const t = await setup();
    await t.set(t.areas, [t.areas.options.Web]);
    await t.set(t.points, 2);
    const copyId = newTaskId();
    await t.client.tasks.duplicate({
      ...t.base,
      taskId: t.task.id,
      id: copyId,
      position: positionAt(9),
    });

    expect((await taskRow(copyId))?.fieldValues).toEqual({
      [t.areas.id]: [t.areas.options.Web],
      [t.points.id]: 2,
    });
  });
});

describe("history of typed values", () => {
  it("snapshots each kind of value and folds repeated edits of one Field", async () => {
    const t = await setup();
    await t.set(t.areas, [t.areas.options.API]);
    await t.set(t.areas, [t.areas.options.API, t.areas.options.Web]);
    await t.set(t.points, 3);
    await t.set(t.points, 4);
    await t.set(t.reviewed, true);
    await t.set(t.reviewed, null);

    const story = (await storyOf(t.task.id)).filter(
      (e) => e.type === "field_changed",
    );
    expect(story.map((e) => e.data)).toEqual([
      {
        field: { id: t.areas.id, name: "Areas" },
        from: null,
        to: {
          options: [
            { id: t.areas.options.API, name: "API", color: expect.any(String) },
            { id: t.areas.options.Web, name: "Web", color: expect.any(String) },
          ],
        },
      },
      {
        field: { id: t.points.id, name: "Points" },
        from: null,
        to: { value: 4 },
      },
    ]);
  });
});

describe("deleting options of a multi choice", () => {
  it("removes the option from arrays, keeps the rest and drops emptied values", async () => {
    const t = await setup();
    const both = t.task;
    const only = await t.addTask("To Do", { title: "Only API" });
    const field = { fieldId: t.areas.id };
    await t.set(t.areas, [t.areas.options.API, t.areas.options.Web], both.id);
    await t.set(t.areas, [t.areas.options.API], only.id);

    await t.client.projects.fields.options.remove({
      ...t.base,
      ...field,
      optionId: t.areas.options.API,
    });

    expect((await taskRow(both.id))?.fieldValues).toEqual({
      [t.areas.id]: [t.areas.options.Web],
    });
    expect((await taskRow(only.id))?.fieldValues).toEqual({});
  });

  it("counts Tasks per Field and per option, once each, for the confirmation", async () => {
    const t = await setup();
    const other = await t.addTask("To Do", { title: "Other" });
    await t.set(t.areas, [t.areas.options.API, t.areas.options.Web]);
    await t.set(t.areas, [t.areas.options.API], other.id);
    await t.set(t.note, "hello");

    const usage = await t.client.projects.fields.usage(t.base);

    expect(usage).toEqual(
      expect.arrayContaining([
        { fieldId: t.areas.id, optionId: null, count: 2 },
        { fieldId: t.areas.id, optionId: t.areas.options.API, count: 2 },
        { fieldId: t.areas.id, optionId: t.areas.options.Web, count: 1 },
        { fieldId: t.note.id, optionId: null, count: 1 },
      ]),
    );
    // No per-value rows for text.
    expect(usage.filter((row) => row.fieldId === t.note.id)).toHaveLength(1);
  });
});

describe("export, import and readers by name", () => {
  it("round-trips every type by name", async () => {
    const t = await setup();
    await t.set(t.areas, [t.areas.options.API, t.areas.options.Docs]);
    await t.set(t.note, "hi");
    await t.set(t.points, 7);
    await t.set(t.target, "2026-12-24");
    await t.set(t.reviewed, true);

    const document = await t.client.tasks.export(t.base);
    const exported = document.tasks.find((x) => x.title === "Typed")?.fields;
    expect(exported).toEqual({
      Areas: ["API", "Docs"],
      Note: "hi",
      Points: 7,
      Target: "2026-12-24",
      Reviewed: true,
    });
    expect(document.fields.find((f) => f.name === "Points")).toMatchObject({
      type: "number",
      config: { min: 0, max: 100, unit: "pts" },
    });

    const { createProject } = await import("./helpers/projects");
    const into = await createProject(t.client, t.workspace.id, "DST");
    const result = await t.client.tasks.import({
      workspaceId: t.workspace.id,
      projectId: into.id,
      document,
    });
    expect(result.warnings).toEqual([]);

    const copy = (
      await t.client.tasks.search({
        workspaceId: t.workspace.id,
        projectId: into.id,
      })
    ).tasks.find((x) => x.title === "Typed");
    expect(copy?.fields).toEqual(exported);
  });

  it("drops an imported value that does not fit its Field, with a warning", async () => {
    const t = await setup();
    const result = await t.client.tasks.import({
      ...t.base,
      document: {
        tasks: [
          {
            title: "Out of range",
            column: "To Do",
            fields: { Points: 1000, Note: "kept", Target: "soon" },
          },
        ],
      },
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        { kind: "value_dropped", field: "Points", count: 1 },
        { kind: "value_dropped", field: "Target", count: 1 },
      ]),
    );
    const kept = (await t.client.tasks.search(t.base)).tasks.find(
      (x) => x.title === "Out of range",
    );
    expect(kept?.fields).toEqual({ Note: "kept" });
  });
});
