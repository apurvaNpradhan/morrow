import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { linkRows, newLinkId } from "./helpers/links";
import { as, rejection } from "./helpers/projects";
import { setupTasks } from "./helpers/tasks";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
});

async function setup() {
  const context = await setupTasks();
  const task = await context.addTask("To Do", { title: "Linked" });
  const target = { ...context.base, taskId: task.id };
  const add = (url = "https://github.com/acme/app/pull/1", title?: string) => {
    const id = newLinkId();
    return context.client.links
      .add({ ...target, id, url, title })
      .then((created) => ({ ...created, id }));
  };
  return { ...context, task, target, add };
}

async function xminOfLink(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM task_link WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("adding a link", () => {
  it("stores it with its creator and returns the txid", async () => {
    const { owner, task, add } = await setup();

    const created = await add("https://example.com/a", "  Design  ");

    expect(created.txid).toBe(await xminOfLink(created.id));
    expect(await linkRows(task.id)).toMatchObject([
      {
        id: created.id,
        url: "https://example.com/a",
        title: "Design",
        createdBy: owner.id,
      },
    ]);
  });

  it("stores an empty title as none", async () => {
    const { task, add } = await setup();
    await add("https://example.com/a", "   ");
    expect((await linkRows(task.id))[0]?.title).toBeNull();
  });

  it("accepts http and https only", async () => {
    const { client, target } = await setup();
    const attempt = (url: string) =>
      rejection(client.links.add({ ...target, id: newLinkId(), url }));

    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://example.com/file",
      "not a url",
      `https://example.com/${"a".repeat(2048)}`,
    ]) {
      expect(await attempt(url)).toMatchObject({ code: "BAD_REQUEST" });
    }
    await client.links.add({
      ...target,
      id: newLinkId(),
      url: "http://example.com",
    });
  });

  it("refuses a bad or taken id", async () => {
    const { client, target, add } = await setup();
    const taken = await add("https://example.com/one");

    const bad = await rejection(
      client.links.add({ ...target, id: "nope", url: "https://example.com/x" }),
    );
    const reused = await rejection(
      client.links.add({
        ...target,
        id: taken.id,
        url: "https://example.com/y",
      }),
    );

    expect(bad).toMatchObject({ data: { code: "INVALID_LINK_ID" } });
    expect(reused).toMatchObject({ data: { code: "LINK_ID_TAKEN" } });
  });

  it("returns the existing link for a URL the task already has, writing nothing", async () => {
    const { task, add } = await setup();
    const first = await add("https://example.com/same");

    const again = await add("https://example.com/same");

    expect(again.id).not.toBe(first.id);
    const duplicate = await db
      .select()
      .from(schema.taskLinkTable)
      .where(eq(schema.taskLinkTable.id, again.id));
    expect(duplicate).toHaveLength(0);
    expect(await linkRows(task.id)).toHaveLength(1);
  });

  it("refuses the 51st link", async () => {
    const { client, target, add, task } = await setup();
    await db.insert(schema.taskLinkTable).values(
      Array.from({ length: 50 }, (_, index) => ({
        id: newLinkId(),
        taskId: task.id,
        projectId: target.projectId,
        url: `https://example.com/${index}`,
      })),
    );

    const over = await rejection(
      client.links.add({
        ...target,
        id: newLinkId(),
        url: "https://example.com/over",
      }),
    );

    expect(over).toMatchObject({ data: { code: "TOO_MANY_LINKS" } });
    expect(await linkRows(task.id)).toHaveLength(50);
    // The same URL as an existing one is still fine at the limit.
    expect((await add("https://example.com/0")).txid).toBeNull();
  });

  it("is refused to a Viewer, who cannot edit the task", async () => {
    const { target, workspace } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const refused = await rejection(
      viewer.links.add({
        ...target,
        id: newLinkId(),
        url: "https://example.com/v",
      }),
    );

    expect(refused).toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("changing and removing a link", () => {
  it("edits the title and the URL, leaving what is not passed", async () => {
    const { client, target, task, add } = await setup();
    const link = await add("https://example.com/a", "Old");

    await client.links.update({ ...target, linkId: link.id, title: "New" });
    expect((await linkRows(task.id))[0]).toMatchObject({
      url: "https://example.com/a",
      title: "New",
    });

    await client.links.update({
      ...target,
      linkId: link.id,
      url: "https://example.com/b",
    });
    expect((await linkRows(task.id))[0]).toMatchObject({
      url: "https://example.com/b",
      title: "New",
    });

    await client.links.update({ ...target, linkId: link.id, title: "" });
    expect((await linkRows(task.id))[0]?.title).toBeNull();
  });

  it("refuses pointing a link at a URL the task already has", async () => {
    const { client, target, add } = await setup();
    await add("https://example.com/a");
    const other = await add("https://example.com/b");

    const clash = await rejection(
      client.links.update({
        ...target,
        linkId: other.id,
        url: "https://example.com/a",
      }),
    );

    expect(clash).toMatchObject({ data: { code: "LINK_URL_TAKEN" } });
  });

  it("removes a link, and says not found for one that is gone", async () => {
    const { client, target, task, add } = await setup();
    const link = await add();

    const removed = await client.links.delete({ ...target, linkId: link.id });

    expect(removed.txid).toBeGreaterThan(0);
    expect(await linkRows(task.id)).toHaveLength(0);
    const again = await rejection(
      client.links.delete({ ...target, linkId: link.id }),
    );
    expect(again).toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes the links with their task", async () => {
    const { task, add } = await setup();
    await add("https://example.com/a");

    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));

    expect(await linkRows(task.id)).toHaveLength(0);
  });

  it("is refused for a link of another task", async () => {
    const { client, target, addTask, add } = await setup();
    const link = await add();
    const other = await addTask("To Do", { title: "Other" });

    const wrong = await rejection(
      client.links.delete({ ...target, taskId: other.id, linkId: link.id }),
    );

    expect(wrong).toMatchObject({ code: "NOT_FOUND" });
  });
});
