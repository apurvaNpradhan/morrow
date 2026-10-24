import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { commentRows, newCommentId } from "./helpers/comments";
import { resetTestDatabase } from "./helpers/database";
import { storyOf } from "./helpers/history";
import { labelFactory, labelRows } from "./helpers/labels";
import { as, createProject } from "./helpers/projects";
import { setupTasks, taskRow } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

/** A project with one labelled, commented task, ready to export. */
async function setupSource() {
  const source = await setupTasks("SRC");
  const target = await createProject(source.client, source.workspace.id, "DST");
  const addLabel = labelFactory(source.client, source.workspace.id);
  const bug = await addLabel("Bug");
  const design = await addLabel("Design");
  const colleague = await addWorkspaceMember(source.workspace.id, "member");
  const task = await source.addTask("To Do", { title: "Talk about it" });
  const taskTarget = { ...source.base, taskId: task.id };
  await source.client.tasks.addLabel({ ...taskTarget, labelId: bug.id });
  await source.client.tasks.addLabel({ ...taskTarget, labelId: design.id });
  await source.client.comments.create({
    ...taskTarget,
    id: newCommentId(),
    body: "From the owner",
  });
  const theirs = newCommentId();
  await as(colleague).comments.create({
    ...taskTarget,
    id: theirs,
    body: "From a colleague",
  });
  await as(colleague).comments.update({
    ...taskTarget,
    commentId: theirs,
    body: "From a colleague, edited",
  });
  const into = (projectId: string) => ({
    workspaceId: source.workspace.id,
    projectId,
  });
  return { ...source, target, colleague, task, into, addLabel };
}

describe("exporting labels and comments", () => {
  it("writes the labels in use and, per task, label names and comments with author emails", async () => {
    const { client, base, owner, colleague, addLabel } = await setupSource();
    await addLabel("Unused");

    const document = await client.tasks.export(base);

    expect(document.labels).toEqual([
      { name: "Bug", color: "#ef4444" },
      { name: "Design", color: "#ef4444" },
    ]);
    const [task] = document.tasks;
    expect(task?.labels.toSorted()).toEqual(["Bug", "Design"]);
    expect(
      task?.comments.map(({ authorEmail, body, editedAt }) => [
        authorEmail,
        body,
        editedAt !== null,
      ]),
    ).toEqual([
      [owner.email, "From the owner", false],
      [colleague.email, "From a colleague, edited", true],
    ]);
  });
});

describe("importing labels and comments", () => {
  it("round-trips into another project, reusing labels by name and keeping comment times", async () => {
    const { client, base, workspace, target, task, into } = await setupSource();
    const before = await commentRows(task.id);

    const document = await client.tasks.export(base);
    const result = await client.tasks.import({
      ...into(target.id),
      document,
    });
    const [copied] = await client.tasks.list(into(target.id));
    const copy = await taskRow(copied!.id);
    const copiedComments = await commentRows(copied!.id);

    expect(result).toMatchObject({ created: 1, warnings: [] });
    expect(await labelRows(workspace.id)).toHaveLength(2);
    expect(copy?.labelIds).toEqual(task && (await taskRow(task.id))?.labelIds);
    expect(copy?.commentCount).toBe(2);
    expect(copiedComments.map((comment) => comment.body)).toEqual(
      before.map((comment) => comment.body),
    );
    expect(copiedComments.map((comment) => comment.createdAt)).toEqual(
      before.map((comment) => comment.createdAt),
    );
    expect(copiedComments[1]?.editedAt).toBeInstanceOf(Date);
    expect(copiedComments.map((comment) => comment.authorId)).toEqual(
      before.map((comment) => comment.authorId),
    );
  });

  it("writes a day as YYYY-MM-DD and a moment as ISO UTC, and reads both back", async () => {
    const { client, base, addTask, target, into } = await setupSource();
    await addTask("To Do", {
      title: "Moment",
      dueDate: "2026-11-02T15:00+05:30",
    });
    await addTask("To Do", { title: "Day", dueDate: "2026-11-03" });

    const document = await client.tasks.export(base);
    const dates = Object.fromEntries(
      document.tasks.map((task) => [task.title, task.dueDate]),
    );
    expect(dates).toMatchObject({
      Moment: "2026-11-02T09:30:00.000Z",
      Day: "2026-11-03",
    });

    await client.tasks.import({ ...into(target.id), document });
    const copies = await client.tasks.list(into(target.id));
    expect(copies.map((task) => [task.title, task.dueDate]).sort()).toEqual(
      expect.arrayContaining([
        ["Moment", "2026-11-02T09:30:00.000Z"],
        ["Day", "2026-11-03"],
      ]),
    );
  });

  it("still imports an old export file, whose due date is a bare day", async () => {
    const { client, base, into, target } = await setupSource();
    const document = await client.tasks.export(base);
    const old = {
      ...document,
      tasks: document.tasks.map((task) => ({ ...task, dueDate: "2025-01-31" })),
    };

    await client.tasks.import({ ...into(target.id), document: old });

    const [copied] = await client.tasks.list(into(target.id));
    expect(await taskRow(copied!.id)).toMatchObject({
      dueAt: new Date("2025-01-31T00:00:00Z"),
      dueHasTime: false,
    });
  });

  it("matches labels ignoring case and creates missing ones for a member who may create labels", async () => {
    const { workspace, target, into, client } = await setupSource();
    const member = as(await addWorkspaceMember(workspace.id, "member"));
    const document = {
      labels: [{ name: "Ops", color: "#14b8a6" }],
      tasks: [
        { title: "Imported", column: "To Do", labels: ["bUG", "Ops", "ops"] },
      ],
    };

    const result = await member.tasks.import({
      ...into(target.id),
      document,
    });
    const labels = await labelRows(workspace.id);
    const [copied] = await client.tasks.list(into(target.id));

    expect(result.warnings).toEqual([]);
    expect(labels.map((label) => label.name)).toEqual(["Bug", "Design", "Ops"]);
    expect(labels[2]).toMatchObject({ color: "#14b8a6" });
    expect(copied?.labelIds).toHaveLength(2);
  });

  it("drops missing labels with a warning when the importer may not create labels", async () => {
    const { workspace, target, into } = await setupSource();
    // A custom role that may import tasks but not create labels.
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "importer",
      permission: JSON.stringify({
        workspace: ["read"],
        task: ["create"],
        label: [],
      }),
    });
    const importer = await addWorkspaceMember(workspace.id, "importer");

    const result = await as(importer).tasks.import({
      ...into(target.id),
      document: {
        tasks: [
          { title: "A", column: "To Do", labels: ["Bug", "Brand new"] },
          { title: "B", column: "To Do", labels: ["Brand new"] },
        ],
      },
    });

    expect(result.created).toBe(2);
    expect(result.warnings).toEqual([
      { kind: "label_dropped", label: "Brand new", count: 2 },
    ]);
    expect((await labelRows(workspace.id)).map((label) => label.name)).toEqual([
      "Bug",
      "Design",
    ]);
  });

  it("imports a comment by an unknown email as no author, with a warning", async () => {
    const { client, target, into } = await setupSource();

    const result = await client.tasks.import({
      ...into(target.id),
      document: {
        tasks: [
          {
            title: "Has remarks",
            column: "To Do",
            comments: [
              {
                authorEmail: "stranger@example.com",
                body: "Who am I",
                createdAt: "2026-01-02T03:04:05.000Z",
              },
              { authorEmail: null, body: "Already gone" },
              { authorEmail: "x@example.com", body: "   " },
            ],
          },
        ],
      },
    });
    const [copied] = await client.tasks.list(into(target.id));
    const comments = await commentRows(copied!.id);

    expect(result.warnings).toEqual([
      {
        kind: "comment_author_unknown",
        email: "stranger@example.com",
        count: 1,
      },
    ]);
    expect(comments.map((comment) => [comment.authorId, comment.body])).toEqual(
      [
        [null, "Who am I"],
        [null, "Already gone"],
      ],
    );
    expect(comments[0]?.createdAt.toISOString()).toBe(
      "2026-01-02T03:04:05.000Z",
    );
    expect(copied?.commentCount).toBe(2);
  });

  it("gives every imported task one 'imported' history entry", async () => {
    const { client, target, into } = await setupSource();

    await client.tasks.import({
      ...into(target.id),
      document: {
        tasks: [
          { title: "One", column: "To Do" },
          { title: "Two", column: "To Do" },
        ],
      },
    });
    const copies = await client.tasks.list(into(target.id));

    expect(copies).toHaveLength(2);
    for (const copy of copies) {
      expect(await storyOf(copy.id)).toEqual([{ type: "imported", data: {} }]);
    }
  });
});
