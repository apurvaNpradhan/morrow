import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { commentRows, newCommentId } from "./helpers/comments";
import { resetTestDatabase } from "./helpers/database";
import { as, rejection } from "./helpers/projects";
import { setupTasks, taskRow } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const { addTask } = context;
  const task = await addTask("To Do", { title: "Talk about me" });
  const target = { ...context.base, taskId: task.id };
  const post = (body = "Hello", client = context.client) => {
    const id = newCommentId();
    return client.comments
      .create({ ...target, id, body })
      .then((created) => ({ ...created, id }));
  };
  const as_ = async (role: string) =>
    as(await addWorkspaceMember(context.workspace.id, role));
  return { ...context, task, target, post, as_ };
}

async function xminOfComment(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM task_comment WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("posting a comment", () => {
  it("stores it with its author, bumps the task's count and returns the txid", async () => {
    const { owner, task, post } = await setup();

    const created = await post("  Looks **good**  ");

    expect(created.txid).toBe(await xminOfComment(created.id));
    expect(await commentRows(task.id)).toMatchObject([
      {
        id: created.id,
        authorId: owner.id,
        body: "Looks **good**",
        editedAt: null,
      },
    ]);
    expect((await taskRow(task.id))?.commentCount).toBe(1);
  });

  it("refuses an empty or too long body, a bad id and a taken id", async () => {
    const { client, target, post } = await setup();
    const existing = await post();
    const create = (input: Record<string, unknown>) =>
      client.comments.create({
        ...target,
        id: newCommentId(),
        body: "x",
        ...input,
      });

    const empty = await rejection(create({ body: "  \n " }));
    const tooLong = await rejection(create({ body: "x".repeat(10_001) }));
    const exactly = await create({ body: "x".repeat(10_000) });
    const badId = await rejection(create({ id: "nope" }));
    const taken = await rejection(create({ id: existing.id }));

    expect(empty.code).toBe("BAD_REQUEST");
    expect(tooLong.code).toBe("BAD_REQUEST");
    expect(exactly.txid).toBeGreaterThan(0);
    expect(badId.data?.code).toBe("INVALID_COMMENT_ID");
    expect(taken.data?.code).toBe("COMMENT_ID_TAKEN");
  });

  it("lets a Viewer comment", async () => {
    const { task, post, as_ } = await setup();
    const viewer = await as_("viewer");

    const created = await post("Feedback from a viewer", viewer);

    expect(created.txid).toBeGreaterThan(0);
    expect((await commentRows(task.id))[0]?.body).toBe(
      "Feedback from a viewer",
    );
  });

  it("allows comments on an archived task but not in an archived project", async () => {
    const { client, base, task, post } = await setup();
    await client.tasks.archive({ ...base, taskId: task.id });
    await expect(post("On an archived task")).resolves.toBeDefined();

    await client.projects.archive({
      workspaceId: base.workspaceId,
      projectId: base.projectId,
    });
    const refusal = await rejection(post("In an archived project"));

    expect(refusal.data?.code).toBe("PROJECT_ARCHIVED");
    expect(await commentRows(task.id)).toHaveLength(1);
  });

  it("does not reach a task of another workspace or project", async () => {
    const { client, target } = await setup();
    const other = await setupTasks("OTH");
    const foreign = await other.addTask();

    const refusal = await rejection(
      client.comments.create({
        ...target,
        taskId: foreign.id,
        id: newCommentId(),
        body: "Not yours",
      }),
    );

    expect(refusal.code).toBe("NOT_FOUND");
  });

  it("is recorded in the workspace activity without the text", async () => {
    const { workspace, task, post } = await setup();

    await post("A secret plan");

    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.type, "comment.created"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workspaceId: workspace.id,
      resourceType: "task",
      resourceId: task.id,
      eventData: {
        ticketId: "MOR-1",
        taskTitle: "Talk about me",
      },
    });
    expect(JSON.stringify(rows[0])).not.toContain("secret plan");
  });
});

describe("editing a comment", () => {
  it("sets the text and marks it edited, for the author only", async () => {
    const { client, target, task, post, as_ } = await setup();
    const { id } = await post("First draft");

    const edited = await client.comments.update({
      ...target,
      commentId: id,
      body: "Second draft",
    });

    expect(edited.txid).toBe(await xminOfComment(id));
    const [row] = await commentRows(task.id);
    expect(row?.body).toBe("Second draft");
    expect(row?.editedAt).toBeInstanceOf(Date);

    const colleague = await as_("member");
    const admin = await as_("admin");
    for (const other of [colleague, admin]) {
      const refusal = await rejection(
        other.comments.update({ ...target, commentId: id, body: "Hijacked" }),
      );
      expect(refusal.data?.code).toBe("COMMENT_NOT_YOURS");
    }
    expect((await commentRows(task.id))[0]?.body).toBe("Second draft");
  });

  it("refuses the owner too when the comment is someone else's", async () => {
    const { client, target, post, as_ } = await setup();
    const colleague = await as_("member");
    const { id } = await post("Colleague's words", colleague);

    const refusal = await rejection(
      client.comments.update({ ...target, commentId: id, body: "Mine now" }),
    );

    expect(refusal.data?.code).toBe("COMMENT_NOT_YOURS");
  });
});

describe("deleting a comment", () => {
  it("lets the author delete theirs and drops the count", async () => {
    const { client, target, task, post } = await setup();
    const { id } = await post();
    await post("Another");

    const deleted = await client.comments.delete({ ...target, commentId: id });

    expect(deleted.txid).toBeGreaterThan(0);
    expect(await commentRows(task.id)).toHaveLength(1);
    expect((await taskRow(task.id))?.commentCount).toBe(1);
  });

  it("lets an admin delete anyone's but refuses another member", async () => {
    const { target, task, post, as_ } = await setup();
    const colleague = await as_("member");
    const stranger = await as_("member");
    const admin = await as_("admin");
    const { id } = await post("Posted by a member", colleague);

    const refusal = await rejection(
      stranger.comments.delete({ ...target, commentId: id }),
    );
    await admin.comments.delete({ ...target, commentId: id });

    expect(refusal.data?.code).toBe("COMMENT_NOT_YOURS");
    expect(await commentRows(task.id)).toHaveLength(0);
    expect((await taskRow(task.id))?.commentCount).toBe(0);
  });

  it("goes with its task", async () => {
    const { client, base, task, post } = await setup();
    await post();

    await client.tasks.remove({ ...base, taskId: task.id });

    expect(await commentRows(task.id)).toHaveLength(0);
  });
});

describe("a comment whose author is gone", () => {
  it("stays, with no author", async () => {
    const { task, post, workspace } = await setup();
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const { id } = await post("Last words", as(colleague));

    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, colleague.id));

    const [row] = await commentRows(task.id);
    expect(row).toMatchObject({ id, authorId: null, body: "Last words" });
  });
});
