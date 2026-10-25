import { asc, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { newCommentId } from "./helpers/comments";
import { resetTestDatabase } from "./helpers/database";
import { addField } from "./helpers/fields";
import { storyOf } from "./helpers/history";
import { labelFactory } from "./helpers/labels";
import { columnsOf, rejection } from "./helpers/projects";
import { newTaskId, setupTasks, taskRow, xminOfTask } from "./helpers/tasks";

// A Monday. Only `Date` is faked, and it keeps running (a frozen clock gives every history entry one timestamp); the database keeps its own clock.
const NOW = new Date("2026-10-26T10:00:00Z");

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const rule = (compact: string, ...rrule: string[]) =>
  `DTSTART;VALUE=DATE:${compact}\nRRULE:${rrule.join(";")}`;
const weekly = (compact: string) => rule(compact, "FREQ=WEEKLY");

async function setup() {
  const context = await setupTasks();
  const { client, base, byName, nextPosition } = context;
  const target = (taskId: string) => ({ ...base, taskId });
  const setRule = (taskId: string, recurrence: string | null) =>
    client.tasks.updateRecurrence({ ...target(taskId), recurrence });
  const move = (taskId: string, column: string) =>
    client.tasks.move({
      ...target(taskId),
      columnId: byName(column).id,
      position: nextPosition(byName(column).id),
    });
  /** A task due on `due` (YYYY-MM-DD) that repeats by `recurrence`. */
  async function repeating(
    recurrence: string,
    due: string,
    extra: Parameters<typeof context.addTask>[1] = {},
  ) {
    const task = await context.addTask("To Do", { dueDate: due, ...extra });
    await setRule(task.id, recurrence);
    return task;
  }
  const tasks = (projectId = context.projectId) =>
    db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, projectId))
      .orderBy(asc(schema.taskTable.number));
  return { ...context, target, setRule, move, repeating, tasks };
}

describe("setting a rule", () => {
  it("saves it, returns the txid and records the change", async () => {
    const { addTask, setRule } = await setup();
    const task = await addTask("To Do", { dueDate: "2026-10-30" });

    const { txid } = await setRule(task.id, weekly("20261030"));

    expect(txid).toBe(await xminOfTask(task.id));
    expect((await taskRow(task.id))?.recurrence).toBe(weekly("20261030"));
    expect((await storyOf(task.id)).at(-1)).toEqual({
      type: "recurrence",
      data: { from: null, to: weekly("20261030") },
    });
  });

  it.each([
    ["BYHOUR", rule("20261030", "FREQ=DAILY", "BYHOUR=9"), "UNSUPPORTED_PART"],
    [
      "BYSETPOS",
      rule("20261030", "FREQ=MONTHLY", "BYDAY=MO,TU", "BYSETPOS=1"),
      "UNSUPPORTED_PART",
    ],
    [
      "UNTIL with COUNT",
      rule("20261030", "FREQ=DAILY", "UNTIL=20261231", "COUNT=3"),
      "UNTIL_AND_COUNT",
    ],
    [
      "a DTSTART that is not the due date",
      weekly("20261031"),
      "DTSTART_MISMATCH",
    ],
    [
      "an ordinal under WEEKLY",
      rule("20261030", "FREQ=WEEKLY", "BYDAY=2TU"),
      "ORDINAL_NOT_MONTHLY",
    ],
  ])("refuses %s", async (_name, recurrence, reason) => {
    const { addTask, setRule } = await setup();
    const task = await addTask("To Do", { dueDate: "2026-10-30" });

    const error = await rejection(setRule(task.id, recurrence));

    expect(error.data).toMatchObject({ code: "INVALID_RECURRENCE", reason });
    expect((await taskRow(task.id))?.recurrence).toBeNull();
  });

  it("accepts a timed rule written in the setter's zone", async () => {
    const { addTask, setRule } = await setup();
    const task = await addTask("To Do", { dueDate: "2026-10-30T15:00+05:30" });

    await setRule(
      task.id,
      "DTSTART;TZID=Asia/Kolkata:20261030T150000\nRRULE:FREQ=WEEKLY;BYDAY=FR",
    );

    expect((await taskRow(task.id))?.recurrence).toContain("TZID=Asia/Kolkata");
  });

  it("needs a due date and refuses a subtask", async () => {
    const { addTask, setRule, client, target } = await setup();
    const undated = await addTask("To Do");
    const parent = await addTask("To Do", { dueDate: "2026-10-30" });
    const child = await addTask("To Do", {
      dueDate: "2026-10-30",
      parentId: parent.id,
    });

    expect(
      (await rejection(setRule(undated.id, weekly("20261030")))).data?.code,
    ).toBe("RECURRENCE_NEEDS_DUE_DATE");
    expect(
      (await rejection(setRule(child.id, weekly("20261030")))).data?.code,
    ).toBe("SUBTASK_CANNOT_REPEAT");

    const repeater = await addTask("To Do", { dueDate: "2026-10-30" });
    await setRule(repeater.id, weekly("20261030"));
    const refused = await rejection(
      client.tasks.updateParent({
        ...target(repeater.id),
        parentId: parent.id,
      }),
    );
    expect(refused.data?.code).toBe("SUBTASK_CANNOT_REPEAT");
  });

  it("removes the rule with null", async () => {
    const { repeating, setRule } = await setup();
    const task = await repeating(weekly("20261030"), "2026-10-30");

    await setRule(task.id, null);

    expect((await taskRow(task.id))?.recurrence).toBeNull();
  });
});

describe("the due date drives the rule", () => {
  it("moves DTSTART and lowers COUNT when the due date moves", async () => {
    const { repeating, client, target } = await setup();
    const task = await repeating(
      rule("20261030", "FREQ=DAILY", "COUNT=5"),
      "2026-10-30",
    );

    await client.tasks.updateDueDate({
      ...target(task.id),
      dueDate: "2026-11-01",
    });

    expect((await taskRow(task.id))?.recurrence).toBe(
      rule("20261101", "FREQ=DAILY", "COUNT=3"),
    );
  });

  it("switches between VALUE=DATE and TZID when a day becomes a moment", async () => {
    const { repeating, client, target } = await setup();
    const task = await repeating(weekly("20261030"), "2026-10-30");

    await client.tasks.updateDueDate({
      ...target(task.id),
      dueDate: "2026-10-30T09:30:00Z",
    });

    // The server cannot see the browser, so a rule without a zone gets UTC.
    expect((await taskRow(task.id))?.recurrence).toBe(
      "DTSTART;TZID=UTC:20261030T093000\nRRULE:FREQ=WEEKLY",
    );
  });

  it("writes it in the editor's own zone when they chose one", async () => {
    const { repeating, client, target, owner } = await setup();
    await db
      .update(schema.userTable)
      .set({ timeZone: "Asia/Kolkata" })
      .where(eq(schema.userTable.id, owner.id));
    const task = await repeating(weekly("20261030"), "2026-10-30");

    await client.tasks.updateDueDate({
      ...target(task.id),
      dueDate: "2026-10-30T09:30:00Z",
    });

    expect((await taskRow(task.id))?.recurrence).toContain(
      "TZID=Asia/Kolkata:20261030T150000",
    );
  });

  it("clears the rule with the due date and records both", async () => {
    const { repeating, client, target } = await setup();
    const task = await repeating(weekly("20261030"), "2026-10-30");

    await client.tasks.updateDueDate({ ...target(task.id), dueDate: null });

    expect(await taskRow(task.id)).toMatchObject({
      dueAt: null,
      recurrence: null,
    });
    const story = await storyOf(task.id);
    expect(story.map((event) => event.type)).toEqual(
      expect.arrayContaining(["due_date", "recurrence"]),
    );
  });

  it("moves or clears the rules of a bulk due-date change", async () => {
    const { repeating, client, base } = await setup();
    const a = await repeating(weekly("20261030"), "2026-10-30");
    const b = await repeating(weekly("20261031"), "2026-10-31");

    await client.tasks.bulkUpdate({
      ...base,
      taskIds: [a.id, b.id],
      change: { type: "dueDate", dueDate: "2026-11-10" },
    });
    expect((await taskRow(a.id))?.recurrence).toBe(weekly("20261110"));
    expect((await taskRow(b.id))?.recurrence).toBe(weekly("20261110"));

    await client.tasks.bulkUpdate({
      ...base,
      taskIds: [a.id, b.id],
      change: { type: "dueDate", dueDate: null },
    });
    expect((await taskRow(a.id))?.recurrence).toBeNull();
    expect((await taskRow(b.id))?.recurrence).toBeNull();
  });
});

/** A repeating task with everything the next one should carry. */
async function richTask(context: Awaited<ReturnType<typeof setup>>) {
  const { client, base, workspace, addTask, repeating, projectId } = context;
  const colleague = await addWorkspaceMember(workspace.id, "member");
  const bug = await labelFactory(client, workspace.id)("Bug");
  const size = await addField(context, "Size", ["Large", "Small"]);
  const task = await repeating(weekly("20261030"), "2026-10-30", {
    title: "Weekly report",
    description: "Write it up",
    priority: "high",
    assigneeId: colleague.id,
    startDate: "2026-10-28",
  });
  const target = { ...base, taskId: task.id };
  await client.tasks.addLabel({ ...target, labelId: bug.id });
  await client.tasks.setFieldValue({
    ...target,
    fieldId: size.id,
    value: size.options.Large!,
  });
  const gather = await addTask("In Progress", {
    title: "Gather",
    parentId: task.id,
  });
  const send = await addTask("Done", { title: "Send", parentId: task.id });
  await addTask("To Do", { title: "Draft", parentId: gather.id });
  await client.comments.create({
    ...target,
    id: newCommentId(),
    body: "Old news",
  });
  return { task, colleague, bug, size, gather, send, projectId };
}

/** What the completion of `old` should have left in `projectId`. */
async function expectNextOccurrence(
  context: Awaited<ReturnType<typeof setup>>,
  old: string,
  projectId: string,
  due: string,
) {
  const rows = await context.tasks(projectId);
  const before = rows.find((row) => row.id === old)!;
  const fresh = rows.filter(
    (row) => row.id !== old && row.title === "Weekly report" && row.recurrence,
  );
  expect(fresh).toHaveLength(1);
  const [next] = fresh;
  const columns = await columnsOf(projectId);
  const firstTodo = columns.find((column) => column.category === "unstarted")!;
  expect(next).toMatchObject({
    columnId: firstTodo.id,
    priority: "high",
    assigneeId: before.assigneeId,
    labelIds: before.labelIds,
    fieldValues: before.fieldValues,
    completedAt: null,
    parentId: null,
    dueAt: new Date(`${due}T00:00:00Z`),
    dueHasTime: false,
  });
  // At the top of its Column.
  const others = rows.filter(
    (row) => row.columnId === firstTodo.id && row.id !== next!.id,
  );
  for (const other of others) {
    expect(next!.position < other.position).toBe(true);
  }
  // The start keeps its two-day distance before the due date.
  const startDay = new Date(`${due}T00:00:00Z`).getTime() - 2 * 86_400_000;
  expect(next!.startAt).toEqual(new Date(startDay));
  // The rule moved: only the newest occurrence carries it.
  expect(before.recurrence).toBeNull();
  expect(next!.recurrence).toBe(weekly(due.replaceAll("-", "")));
  // Subtasks come back open, and their own subtasks with them.
  const family = rows.filter(
    (row) => row.parentId !== null && row.createdAt >= next!.createdAt,
  );
  expect(family.map((row) => row.title).sort()).toEqual([
    "Draft",
    "Gather",
    "Send",
  ]);
  for (const row of family) {
    expect(row).toMatchObject({
      completedAt: null,
      columnId: firstTodo.id,
      startAt: null,
      dueAt: null,
      recurrence: null,
    });
  }
  expect((await taskRow(next!.id))?.subtaskTotal).toBe(2);
  // Both stories point at each other.
  expect((await storyOf(old)).at(-1)).toMatchObject({
    type: "recurred",
    data: { direction: "to" },
  });
  expect(await storyOf(next!.id)).toEqual(
    expect.arrayContaining([
      { type: "created", data: {} },
      expect.objectContaining({
        type: "recurred",
        data: expect.objectContaining({ direction: "from" }),
      }),
    ]),
  );
  return next!;
}

describe("completing a repeating task", () => {
  it("creates the next one when it is moved to Done", async () => {
    const context = await setup();
    const { task } = await richTask(context);

    await context.move(task.id, "Done");

    const next = await expectNextOccurrence(
      context,
      task.id,
      context.projectId,
      "2026-11-06",
    );
    // Comments stay on the occurrence they were written on.
    expect((await taskRow(next.id))?.commentCount).toBe(0);
    expect((await taskRow(task.id))?.commentCount).toBe(1);
    expect(await taskDescriptionOf(next.id)).toBe("Write it up");
  });

  it("creates the next one on a bulk move", async () => {
    const context = await setup();
    const { task } = await richTask(context);

    await context.client.tasks.bulkUpdate({
      ...context.base,
      taskIds: [task.id],
      change: { type: "move", columnId: context.byName("Done").id },
    });

    await expectNextOccurrence(
      context,
      task.id,
      context.projectId,
      "2026-11-06",
    );
  });

  it("creates the next one when its Column is deleted into Done", async () => {
    const context = await setup();
    const { task } = await richTask(context);
    const review = await context.client.projects.columns.create({
      ...context.base,
      name: "Review",
      category: "started",
    });
    await context.client.tasks.move({
      ...context.target(task.id),
      columnId: review.id,
      position: "a0",
    });

    await context.client.projects.columns.remove({
      ...context.base,
      columnId: review.id,
      targetColumnId: context.byName("Done").id,
    });

    await expectNextOccurrence(
      context,
      task.id,
      context.projectId,
      "2026-11-06",
    );
  });

  it("creates the next one when its Column becomes a Done column", async () => {
    const context = await setup();
    const { task } = await richTask(context);
    const review = await context.client.projects.columns.create({
      ...context.base,
      name: "Review",
      category: "started",
    });
    await context.client.tasks.move({
      ...context.target(task.id),
      columnId: review.id,
      position: "a0",
    });

    await context.client.projects.columns.move({
      ...context.base,
      columnId: review.id,
      category: "done",
      position: "a1",
    });

    await expectNextOccurrence(
      context,
      task.id,
      context.projectId,
      "2026-11-06",
    );
  });

  it("creates the next one in the other Project when it is moved there into Done", async () => {
    const context = await setup();
    const { task } = await richTask(context);
    const web = await context.client.projects.create({
      workspaceId: context.workspace.id,
      name: "Website",
      key: "WEB",
    });
    const webColumns = await columnsOf(web.id);
    const done = webColumns.find((column) => column.category === "done")!;

    await context.client.tasks.moveToProject({
      workspaceId: context.workspace.id,
      taskIds: [task.id],
      toProjectId: web.id,
      columnId: done.id,
    });

    await expectNextOccurrence(context, task.id, web.id, "2026-11-06");
  });
});

describe("the next date", () => {
  /** Completes a task and returns the due date text of the one that follows, or null. */
  async function nextDue(recurrence: string, due: string) {
    const context = await setup();
    const task = await context.repeating(recurrence, due);
    await context.move(task.id, "Done");
    const next = (await context.tasks()).find(
      (row) => row.id !== task.id && row.recurrence,
    );
    return next?.dueAt ? next.dueAt.toISOString() : null;
  }

  it.each([
    ["weekly", weekly("20261102"), "2026-11-02", "2026-11-09T00:00:00.000Z"],
    [
      "monthly on day 31, skipping short months",
      rule("20261031", "FREQ=MONTHLY", "BYMONTHDAY=31"),
      "2026-10-31",
      "2026-12-31T00:00:00.000Z",
    ],
    [
      "monthly on the 2nd Tuesday",
      rule("20261113", "FREQ=MONTHLY", "BYDAY=2TU"),
      "2026-11-13",
      "2026-12-08T00:00:00.000Z",
    ],
    [
      "yearly on Feb 29",
      rule("20280229", "FREQ=YEARLY"),
      "2028-02-29",
      "2032-02-29T00:00:00.000Z",
    ],
  ])("%s", async (_name, recurrence, due, expected) => {
    expect(await nextDue(recurrence, due)).toBe(expected);
  });

  it("skips occurrences already past when it is finished late", async () => {
    // Due three weeks ago and finished today: the next is today's or later, not a pile of copies.
    expect(await nextDue(weekly("20261005"), "2026-10-05")).toBe(
      "2026-10-26T00:00:00.000Z",
    );
    expect(await nextDue(rule("20261001", "FREQ=DAILY"), "2026-10-01")).toBe(
      "2026-10-26T00:00:00.000Z",
    );
  });

  it("ends when COUNT is used up or UNTIL has passed", async () => {
    expect(
      await nextDue(rule("20261102", "FREQ=DAILY", "COUNT=1"), "2026-11-02"),
    ).toBeNull();
    expect(
      await nextDue(
        rule("20261102", "FREQ=DAILY", "UNTIL=20261102"),
        "2026-11-02",
      ),
    ).toBeNull();
    const context = await setup();
    const task = await context.repeating(
      rule("20261102", "FREQ=DAILY", "COUNT=1"),
      "2026-11-02",
    );
    await context.move(task.id, "Done");
    expect((await context.tasks()).filter((row) => row.recurrence)).toEqual([]);
    expect((await taskRow(task.id))?.recurrence).toBeNull();
  });

  it("counts down: each occurrence leaves one fewer in COUNT", async () => {
    const context = await setup();
    const task = await context.repeating(
      rule("20261102", "FREQ=DAILY", "COUNT=3"),
      "2026-11-02",
    );

    await context.move(task.id, "Done");

    const next = (await context.tasks()).find((row) => row.recurrence);
    expect(next?.recurrence).toBe(rule("20261103", "FREQ=DAILY", "COUNT=2"));
  });

  it("keeps a timed rule's wall-clock time across a daylight-saving change", async () => {
    const context = await setup();
    // 09:00 in New York is 13:00 UTC before 2026-11-01 and 14:00 UTC after.
    const task = await context.addTask("To Do", {
      dueDate: "2026-10-26T13:00:00Z",
    });
    await context.setRule(
      task.id,
      "DTSTART;TZID=America/New_York:20261026T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO",
    );

    await context.move(task.id, "Done");

    const next = (await context.tasks()).find((row) => row.recurrence);
    expect(next).toMatchObject({
      dueAt: new Date("2026-11-02T14:00:00Z"),
      dueHasTime: true,
    });
    expect(next?.recurrence).toContain("TZID=America/New_York:20261102T090000");
  });
});

async function taskDescriptionOf(taskId: string) {
  const [row] = await db
    .select({ description: schema.taskDescriptionTable.description })
    .from(schema.taskDescriptionTable)
    .where(eq(schema.taskDescriptionTable.taskId, taskId));
  return row?.description;
}

describe("ending a series", () => {
  it("creates nothing and drops the rule when the task is canceled", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");

    await context.move(task.id, "Canceled");

    expect(await context.tasks()).toHaveLength(1);
    expect((await taskRow(task.id))?.recurrence).toBeNull();
  });

  it("drops the rule when the task is archived, alone or in bulk", async () => {
    const context = await setup();
    const a = await context.repeating(weekly("20261030"), "2026-10-30");
    const b = await context.repeating(weekly("20261031"), "2026-10-31");

    await context.client.tasks.archive(context.target(a.id));
    await context.client.tasks.bulkUpdate({
      ...context.base,
      taskIds: [b.id],
      change: { type: "archive", archived: true },
    });

    expect((await taskRow(a.id))?.recurrence).toBeNull();
    expect((await taskRow(b.id))?.recurrence).toBeNull();
    expect(await context.tasks()).toHaveLength(2);
  });

  it("creates nothing when the task is deleted", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");

    await context.client.tasks.remove(context.target(task.id));

    expect(await context.tasks()).toHaveLength(0);
  });

  it("creates nothing when the rule is removed before it is finished", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");
    await context.setRule(task.id, null);

    await context.move(task.id, "Done");

    expect(await context.tasks()).toHaveLength(1);
  });

  it("does nothing when an old occurrence is reopened and finished again", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");
    await context.move(task.id, "Done");
    expect(await context.tasks()).toHaveLength(2);

    await context.move(task.id, "To Do");
    await context.move(task.id, "Done");

    expect(await context.tasks()).toHaveLength(2);
  });

  it("is not copied by a duplicate", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");
    const copyId = newTaskId();

    await context.client.tasks.duplicate({
      ...context.base,
      taskId: task.id,
      id: copyId,
      position: "a9",
    });

    expect((await taskRow(copyId))?.recurrence).toBeNull();
    expect((await taskRow(task.id))?.recurrence).toBe(weekly("20261030"));
  });

  it("keeps a rule through export and import, and never spawns on import", async () => {
    const context = await setup();
    const task = await context.repeating(weekly("20261030"), "2026-10-30");
    await context.move(task.id, "Done");
    const other = await context.client.projects.create({
      workspaceId: context.workspace.id,
      name: "Elsewhere",
      key: "ELS",
    });
    const document = await context.client.tasks.export(context.base);
    // The completed task no longer carries a rule; the new one does.
    const carried = document.tasks.filter((entry) => entry.recurrence);
    expect(carried).toHaveLength(1);

    const result = await context.client.tasks.import({
      workspaceId: context.workspace.id,
      projectId: other.id,
      document,
    });

    expect(result.created).toBe(2);
    const imported = await context.tasks(other.id);
    expect(imported.filter((row) => row.recurrence)).toHaveLength(1);
    expect(imported).toHaveLength(2);
  });

  it("drops an imported rule that does not fit the due date, with a warning", async () => {
    const context = await setup();
    await context.repeating(weekly("20261030"), "2026-10-30");
    const document = await context.client.tasks.export(context.base);
    const wrong = {
      ...document,
      tasks: document.tasks.map((entry) => ({
        ...entry,
        recurrence: weekly("20301230"),
      })),
    };

    const result = await context.client.tasks.import({
      ...context.base,
      document: wrong,
    });

    expect(result.warnings).toContainEqual({
      kind: "recurrence_dropped",
      count: 1,
    });
  });
});

describe("moving a repeating task to another Project", () => {
  it("moves it with its subtasks and keeps the rule", async () => {
    const context = await setup();
    const parent = await context.repeating(weekly("20261030"), "2026-10-30");
    await context.addTask("To Do", { title: "Kid", parentId: parent.id });
    const web = await context.client.projects.create({
      workspaceId: context.workspace.id,
      name: "Website",
      key: "WEB",
    });

    await context.client.tasks.moveToProject({
      workspaceId: context.workspace.id,
      taskIds: [parent.id],
      toProjectId: web.id,
    });

    expect(await taskRow(parent.id)).toMatchObject({
      projectId: web.id,
      recurrence: weekly("20261030"),
    });
  });
});
