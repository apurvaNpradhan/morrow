import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import {
  assetRow,
  objectExists,
  pngBytes,
  uploadAsset,
} from "./helpers/assets";
import { commentRows, newCommentId } from "./helpers/comments";
import { resetTestDatabase } from "./helpers/database";
import { as, createProject, setupWorkspace } from "./helpers/projects";
import {
  newTaskId,
  positionAt,
  setupTasks,
  taskDescription,
} from "./helpers/tasks";

beforeEach(resetTestDatabase);

const png = (name = "shot.png") => ({
  filename: name,
  contentType: "image/png",
  bytes: pngBytes(),
});

type Context = Awaited<ReturnType<typeof setupTasks>>;
type Client = Context["client"];

/** Uploads and finalizes a file, returning the markdown that shows it. */
async function attachment(client: Client, workspaceId: string) {
  const assetId = await uploadAsset(client, workspaceId, png());
  await client.assets.finalize({ workspaceId, assetId });
  return {
    assetId,
    markdown: `![shot.png](/api/asset/${assetId}?w=1200&h=800)`,
  };
}

async function setup() {
  const context = await setupTasks();
  const task = await context.addTask("To Do", { title: "With files" });
  const target = { ...context.base, taskId: task.id };
  const describe_ = (taskId: string, description: string) =>
    context.client.tasks.updateDescription({
      ...context.base,
      taskId,
      description,
    });
  return { ...context, task, target, describe_ };
}

describe("saving a description", () => {
  it("claims the caller's draft for the task", async () => {
    const { client, workspace, task, describe_ } = await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);

    await describe_(task.id, `See ${markdown}`);

    expect(await assetRow(assetId)).toMatchObject({ taskId: task.id });
    expect((await assetRow(assetId))!.attachedAt).toBeInstanceOf(Date);
    expect(await taskDescription(task.id)).toBe(`See ${markdown}`);
  });

  it("claims on create too", async () => {
    const { client, workspace, byName, base, nextPosition } = await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);
    const column = byName("To Do");
    const id = newTaskId();

    await client.tasks.create({
      ...base,
      id,
      columnId: column.id,
      position: nextPosition(column.id),
      title: "Born with a picture",
      description: markdown,
    });

    expect(await assetRow(assetId)).toMatchObject({ taskId: id });
  });

  it("leaves another member's draft and another workspace's asset alone", async () => {
    const { workspace, task, describe_ } = await setup();
    const teammate = as(await addWorkspaceMember(workspace.id, "member"));
    const theirs = await attachment(teammate, workspace.id);
    const elsewhere = await setupWorkspace();
    const foreign = await attachment(elsewhere.client, elsewhere.workspace.id);

    await describe_(task.id, `${theirs.markdown} ${foreign.markdown}`);

    expect((await assetRow(theirs.assetId))!.attachedAt).toBeNull();
    expect((await assetRow(foreign.assetId))!.attachedAt).toBeNull();
    expect(await taskDescription(task.id)).toBe(
      `${theirs.markdown} ${foreign.markdown}`,
    );
  });

  it("deletes nothing when a link is removed", async () => {
    const { client, workspace, task, describe_ } = await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);
    await describe_(task.id, markdown);
    const { objectKey } = (await assetRow(assetId))!;

    await describe_(task.id, "No picture any more");

    expect(await assetRow(assetId)).toMatchObject({ taskId: task.id });
    expect(await objectExists(objectKey)).toBe(true);
  });

  it("gives a task its own copy of another task's file, once", async () => {
    const { client, workspace, task, describe_, addTask } = await setup();
    const other = await addTask("To Do", { title: "Second" });
    const { assetId, markdown } = await attachment(client, workspace.id);
    await describe_(task.id, markdown);

    await describe_(other.id, `Copied: ${markdown}`);
    const copy = (
      await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.taskId, other.id))
    )[0]!;

    expect(copy).toMatchObject({
      sourceAssetId: assetId,
      workspaceId: workspace.id,
      kind: "image",
      width: 1200,
      height: 800,
      size: 64,
      filename: "shot.png",
    });
    expect(copy.id).not.toBe(assetId);
    expect(copy.objectKey).not.toBe((await assetRow(assetId))!.objectKey);
    expect(await objectExists(copy.objectKey)).toBe(true);
    const stored = `Copied: ![shot.png](/api/asset/${copy.id}?w=1200&h=800)`;
    expect(await taskDescription(other.id)).toBe(stored);

    // The editor keeps sending the old link while it autosaves: still one copy.
    await describe_(other.id, `Copied again: ${markdown}`);
    const copies = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.taskId, other.id));
    expect(copies).toHaveLength(1);
    expect(await taskDescription(other.id)).toContain(`/api/asset/${copy.id}`);
  });
});

describe("duplicating a task", () => {
  it("copies its files, which outlive the original", async () => {
    const { client, workspace, task, describe_, base, byName, nextPosition } =
      await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);
    await describe_(task.id, markdown);
    const id = newTaskId();

    await client.tasks.duplicate({
      ...base,
      taskId: task.id,
      id,
      position: nextPosition(byName("To Do").id),
    });
    await client.tasks.remove({ ...base, taskId: task.id });

    const copies = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.taskId, id));
    expect(copies).toHaveLength(1);
    expect(await taskDescription(id)).toBe(
      `![shot.png](/api/asset/${copies[0]!.id}?w=1200&h=800)`,
    );
    expect(await assetRow(assetId)).toBeUndefined();
    expect(await objectExists(copies[0]!.objectKey)).toBe(true);
  });
});

describe("importing tasks", () => {
  it("gives the imported task its own copy of the files its text links to", async () => {
    const { client, workspace, task, describe_, base } = await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);
    await describe_(task.id, markdown);
    const target = await createProject(client, workspace.id, "DST");
    const document = await client.tasks.export(base);

    await client.tasks.import({
      workspaceId: workspace.id,
      projectId: target.id,
      document,
    });

    const [imported] = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, target.id));
    const copies = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.taskId, imported!.id));
    expect(copies).toMatchObject([{ sourceAssetId: assetId }]);
    expect(await taskDescription(imported!.id)).toBe(
      `![shot.png](/api/asset/${copies[0]!.id}?w=1200&h=800)`,
    );
  });
});

describe("comments", () => {
  it("claims files on post and on edit", async () => {
    const { client, workspace, target } = await setup();
    const first = await attachment(client, workspace.id);
    const second = await attachment(client, workspace.id);
    const id = newCommentId();

    await client.comments.create({ ...target, id, body: first.markdown });
    await client.comments.update({
      ...target,
      commentId: id,
      body: `${first.markdown} ${second.markdown}`,
    });

    expect(await assetRow(first.assetId)).toMatchObject({
      taskId: target.taskId,
    });
    expect(await assetRow(second.assetId)).toMatchObject({
      taskId: target.taskId,
    });
    expect((await commentRows(target.taskId))[0]!.body).toBe(
      `${first.markdown} ${second.markdown}`,
    );
  });

  it("lets a Viewer attach a file to a comment", async () => {
    const { workspace, target } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));
    const { assetId, markdown } = await attachment(viewer, workspace.id);

    await viewer.comments.create({
      ...target,
      id: newCommentId(),
      body: markdown,
    });

    expect(await assetRow(assetId)).toMatchObject({ taskId: target.taskId });
  });
});

describe("deleting a task", () => {
  it("deletes its asset rows", async () => {
    const { client, workspace, task, describe_, base } = await setup();
    const { assetId, markdown } = await attachment(client, workspace.id);
    await describe_(task.id, markdown);

    await client.tasks.remove({ ...base, taskId: task.id });

    expect(await assetRow(assetId)).toBeUndefined();
  });
});

void positionAt;
