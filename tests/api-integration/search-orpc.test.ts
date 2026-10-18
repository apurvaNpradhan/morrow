import {
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
} from "../../packages/sync-schemas/src/search";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { newCommentId } from "./helpers/comments";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { as, columnsOf, rejection } from "./helpers/projects";
import { newTaskId, positionAt, setupTasks } from "./helpers/tasks";

beforeEach(resetTestDatabase);

/** A workspace whose owner searches; tasks and comments are added by title and body. */
async function setup() {
  const context = await setupTasks();
  const { client, base } = context;
  const search = (q: string) =>
    client.search.query({ workspaceId: base.workspaceId, q });
  async function comment(taskId: string, body: string) {
    const { id } = await client.comments.create({
      ...base,
      taskId,
      id: newCommentId(),
      body,
    });
    return id;
  }
  const titles = async (q: string) =>
    (await search(q)).tasks.map((task) => task.title);
  return { ...context, search, comment, titles };
}

describe("matching tasks", () => {
  it("finds words in any order, in the title or the description", async () => {
    const { addTask, titles } = await setup();
    await addTask("To Do", { title: "Bug in login screen" });
    await addTask("To Do", {
      title: "Other",
      description: "the login has a bug",
    });
    await addTask("To Do", { title: "Unrelated" });

    expect(await titles("login bug")).toEqual(["Bug in login screen", "Other"]);
  });

  it("stems words and matches the start of the last word", async () => {
    const { addTask, titles } = await setup();
    await addTask("To Do", { title: "Server crash on boot" });
    await addTask("To Do", { title: "Add authentication" });

    expect(await titles("crashes")).toEqual(["Server crash on boot"]);
    expect(await titles("auth")).toEqual(["Add authentication"]);
  });

  it("tolerates a typo in a title", async () => {
    const { addTask, titles } = await setup();
    await addTask("To Do", { title: "Improve database speed" });

    expect(await titles("databaes")).toEqual(["Improve database speed"]);
  });

  it("ranks a title match above a description match", async () => {
    const { addTask, titles } = await setup();
    await addTask("To Do", { title: "Other", description: "about invoices" });
    await addTask("To Do", { title: "Invoices overview" });

    expect(await titles("invoices")).toEqual(["Invoices overview", "Other"]);
  });

  it("treats search syntax as plain text", async () => {
    const { addTask, titles } = await setup();
    await addTask("To Do", { title: "100% done_ish" });

    expect(await titles("%")).toEqual([]);
    expect(await titles("a & | ! ( :*")).toEqual([]);
    expect(await titles("done")).toEqual(["100% done_ish"]);
  });

  it("returns nothing for a query without words", async () => {
    const { search } = await setup();
    expect(await search("  ?! ")).toEqual({ tasks: [], comments: [] });
  });

  it("describes each hit for the list", async () => {
    const { addTask, search, base } = await setup();
    const created = await addTask("In Progress", {
      title: "Describe me",
      priority: "high",
    });

    const [hit] = (await search("describe")).tasks;

    expect(hit).toMatchObject({
      id: created.id,
      ticketId: "MOR-1",
      projectKey: "MOR",
      title: "Describe me",
      priority: "high",
      category: "started",
      archived: false,
      projectArchived: false,
      snippet: null,
    });
    expect(hit?.projectId).toBe(base.projectId);
  });
});

describe("ordering by state", () => {
  it("lists open tasks, then completed, then archived, then archived projects", async () => {
    const { client, base, addTask, search } = await setup();
    const archived = await addTask("To Do", { title: "Report archived" });
    await addTask("Done", { title: "Report done" });
    await addTask("To Do", { title: "Report open" });
    await client.tasks.archive({ ...base, taskId: archived.id });

    const old = await client.projects.create({
      workspaceId: base.workspaceId,
      name: "Old",
      key: "OLD",
    });
    const [column] = await columnsOf(old.id);
    await client.tasks.create({
      workspaceId: base.workspaceId,
      projectId: old.id,
      id: newTaskId(),
      columnId: column!.id,
      position: positionAt(0),
      title: "Report from an archived project",
    });
    await client.projects.archive({
      workspaceId: base.workspaceId,
      projectId: old.id,
    });

    const { tasks } = await search("report");

    expect(tasks.map((task) => task.title)).toEqual([
      "Report open",
      "Report done",
      "Report archived",
      "Report from an archived project",
    ]);
    expect(tasks.map((task) => [task.archived, task.projectArchived])).toEqual([
      [false, false],
      [false, false],
      [true, false],
      [false, true],
    ]);
  });
});

describe("snippets", () => {
  it("shows one for a description match and none for a title match", async () => {
    const { addTask, search } = await setup();
    await addTask("To Do", {
      title: "Checkout",
      description: "Fix the refund flow",
    });
    await addTask("To Do", { title: "Refund policy" });

    const { tasks } = await search("refund");

    const byTitle = new Map(tasks.map((task) => [task.title, task.snippet]));
    expect(byTitle.get("Refund policy")).toBeNull();
    expect(byTitle.get("Checkout")).toContain(
      `${SNIPPET_MARK_START}refund${SNIPPET_MARK_END} flow`,
    );
  });
});

describe("matching comments", () => {
  it("finds a comment with a snippet, and names its task and author", async () => {
    const { owner, addTask, comment, search } = await setup();
    const task = await addTask("To Do", { title: "Payments" });
    const id = await comment(task.id, "We should retry the webhook");
    await comment(task.id, "Nothing to see");

    const { tasks, comments } = await search("webhook");

    expect(tasks).toEqual([]);
    expect(comments).toEqual([
      expect.objectContaining({
        id,
        taskId: task.id,
        ticketId: "MOR-1",
        taskTitle: "Payments",
        authorName: owner.name,
        snippet: expect.stringContaining(
          `${SNIPPET_MARK_START}webhook${SNIPPET_MARK_END}`,
        ),
        archived: false,
        projectArchived: false,
      }),
    ]);
  });

  it("puts comments on open tasks before those on completed ones", async () => {
    const { addTask, comment, search } = await setup();
    const done = await addTask("Done", { title: "Finished" });
    const open = await addTask("To Do", { title: "Going" });
    await comment(done.id, "shared keyword");
    await comment(open.id, "shared keyword");

    const { comments } = await search("keyword");

    expect(comments.map((hit) => hit.taskTitle)).toEqual(["Going", "Finished"]);
  });
});

describe("limits", () => {
  it("returns at most 8 tasks and 5 comments", async () => {
    const { addTask, comment, search } = await setup();
    let last = "";
    for (let n = 0; n < 10; n++) {
      last = (await addTask("To Do", { title: `Widget ${n}` })).id;
    }
    for (let n = 0; n < 7; n++) await comment(last, `widget note ${n}`);

    const { tasks, comments } = await search("widget");

    expect(tasks).toHaveLength(8);
    expect(comments).toHaveLength(5);
  });
});

describe("who can search", () => {
  it("never returns another workspace's rows", async () => {
    const mine = await setup();
    const theirs = await setup();
    await mine.addTask("To Do", { title: "Secret roadmap" });
    const foreign = await theirs.addTask("To Do", { title: "Secret roadmap" });
    await theirs.comment(foreign.id, "secret comment");

    const result = await mine.search("secret");

    expect(result.tasks.map((task) => task.id)).not.toContain(foreign.id);
    expect(result.tasks).toHaveLength(1);
    expect(result.comments).toEqual([]);
  });

  it("refuses someone who is not a member", async () => {
    const { base } = await setup();
    const { user: outsider } = await createWorkspaceMember();

    const refusal = await rejection(
      as(outsider).search.query({
        workspaceId: base.workspaceId,
        q: "anything",
      }),
    );

    expect(refusal.code).toBe("NOT_FOUND");
  });
});
