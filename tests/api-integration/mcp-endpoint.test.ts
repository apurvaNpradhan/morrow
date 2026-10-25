import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { config } from "../../apps/api/src/platform/config";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpClient } from "./helpers/mcp-oauth";
import { signInWithOtp } from "./helpers/otp";

const { app } = createApp();
const protocolVersion = "2026-07-28";

async function signUp(name = "MCP user") {
  const response = await signInWithOtp(
    (path, body) =>
      app.request(`/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        body: JSON.stringify(body),
      }),
    `${randomUUID()}@example.com`,
    { name },
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    token: string;
    user: { id: string; email: string };
  };
  // MCP clients hold an OAuth access token, not the session token.
  return { token: await connectMcpClient(app, body.token), user: body.user };
}

/** A modern (2026-07-28) request: protocol metadata travels with each call. */
function modern(
  token: string | null,
  method: string,
  params: Record<string, unknown> = {},
  id = 1,
) {
  const name = method === "tools/call" ? String(params.name) : undefined;
  return app.request("/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": protocolVersion,
      ...(name ? { "mcp-name": name } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "morrow-mcp-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

type Rpc = {
  result?: {
    tools?: Array<{ name: string }>;
    content: Array<{ text: string }>;
    isError?: boolean;
  };
  error?: unknown;
};

async function rpc(response: Response): Promise<Rpc> {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);
  return JSON.parse(data ?? text) as Rpc;
}

const call = (
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) => modern(token, "tools/call", { name, arguments: args }).then(rpc);

beforeEach(resetTestDatabase);

describe("MCP endpoint", () => {
  it("advertises the public URL in its OAuth metadata", async () => {
    const origin = config.apiUrl.replace(/\/api\/?$/, "");
    const resource = await app.request(
      "/.well-known/oauth-protected-resource/api/mcp",
    );
    expect(await resource.json()).toMatchObject({
      resource: `${origin}/api/mcp`,
      authorization_servers: [`${origin}/api/auth`],
    });
    const server = await app.request(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    expect(await server.json()).toMatchObject({
      issuer: `${origin}/api/auth`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("lists the core tools on independent requests without a session id", async () => {
    const { token } = await signUp();
    const first = await modern(token, "tools/list", {}, 1);
    const second = await modern(token, "tools/list", {}, 2);
    expect(first.status).toBe(200);
    expect(first.headers.has("mcp-session-id")).toBe(false);
    const names = (await rpc(first)).result?.tools?.map((t) => t.name).sort();
    expect(names).toEqual([
      "archive_task",
      "comment_task",
      "create_project",
      "create_tasks",
      "delete_project",
      "delete_task",
      "duplicate_task",
      "get_task",
      "list_activity",
      "list_fields",
      "list_labels",
      "list_members",
      "list_projects",
      "list_tasks",
      "list_workspaces",
      "manage_column",
      "manage_label",
      "manage_link",
      "manage_relation",
      "move_task",
      "move_tasks",
      "update_project",
      "update_tasks",
      "whoami",
    ]);
    const advertised = (await rpc(second)).result?.tools as Array<{
      name: string;
      annotations?: { readOnlyHint?: boolean };
    }>;
    expect(advertised).toHaveLength(24);
    // Reads say so, so a client can run them without asking; writes do not.
    expect(
      advertised
        .filter((tool) => tool.annotations?.readOnlyHint)
        .map((tool) => tool.name)
        .sort(),
    ).toEqual([
      "get_task",
      "list_activity",
      "list_fields",
      "list_labels",
      "list_members",
      "list_projects",
      "list_tasks",
      "list_workspaces",
      "whoami",
    ]);
  });

  it("runs tools as the token's user, concurrently", async () => {
    const { token, user } = await signUp();
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => call(token, "whoami")),
    );
    for (const result of results) {
      expect(result.result?.isError).toBe(false);
      expect(result.result?.content[0].text).toContain(user.email);
    }
  });

  it("reads workspace data the user may see and refuses what they may not", async () => {
    const owner = await signUp("Owner");
    const stranger = await signUp("Stranger");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });

    const allowed = await call(owner.token, "list_members", {
      workspaceId: workspace.id,
    });
    expect(allowed.result?.isError).toBe(false);
    expect(allowed.result?.content[0].text).toContain("Owner");

    const workspaces = await call(owner.token, "list_workspaces");
    expect(workspaces.result?.content[0].text).toContain("shared");

    const denied = await call(stranger.token, "list_members", {
      workspaceId: workspace.id,
    });
    expect(denied.result?.isError).toBe(true);
    expect(denied.result?.content[0].text).not.toContain("Owner");

    const activity = await call(owner.token, "list_activity", {
      workspaceId: workspace.id,
    });
    expect(activity.result?.isError).toBe(false);
  });

  it("gives agents absolute links to attached files", async () => {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared-files", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      expect(response.result?.isError, response.result?.content[0].text).toBe(
        false,
      );
      return JSON.parse(response.result!.content[0].text);
    };
    const { projectId } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });
    await run("create_tasks", {
      projectId,
      items: [
        {
          title: "With a file",
          description: "![x](/api/asset/abc123?w=1&h=2)",
        },
      ],
    });
    await run("comment_task", {
      projectId,
      ticketId: "MOR-1",
      action: "create",
      body: '[r.pdf](/api/asset/def456 "application/pdf 10")',
    });
    const absolute = `${config.apiUrl}/asset`;

    const detail = await run("get_task", { projectId, ticketId: "MOR-1" });
    const listed = await run("list_tasks", {
      projectId,
      withDescription: true,
    });

    expect(detail.description).toBe(`![x](${absolute}/abc123?w=1&h=2)`);
    expect(detail.comments[0].body).toBe(
      `[r.pdf](${absolute}/def456 "application/pdf 10")`,
    );
    expect(listed.tasks[0].description).toBe(
      `![x](${absolute}/abc123?w=1&h=2)`,
    );
  });

  it("writes projects, columns, labels, tasks and comments by name", async () => {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared-writes", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      expect(response.result?.isError, response.result?.content[0].text).toBe(
        false,
      );
      return JSON.parse(response.result!.content[0].text);
    };

    const { projectId } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });
    await run("manage_label", {
      action: "create",
      name: "Bug",
      color: "#ef4444",
    });
    await run("manage_column", {
      projectId,
      action: "create",
      name: "Review",
      category: "started",
    });
    const created = await run("create_tasks", {
      projectId,
      items: [
        { title: "First", labels: ["bug"] },
        { title: "Second", column: "review", assignee: owner.user.email },
      ],
    });
    expect(created).toEqual([
      { index: 0, ticketId: "MOR-1" },
      { index: 1, ticketId: "MOR-2" },
    ]);

    expect(
      await run("update_tasks", {
        projectId,
        items: [
          {
            ticketId: "MOR-1",
            title: "First, renamed",
            priority: "high",
            removeLabels: ["Bug"],
          },
        ],
      }),
    ).toEqual([
      {
        index: 0,
        ticketId: "MOR-1",
        changed: ["title", "priority", "removeLabels"],
      },
    ]);
    await run("update_tasks", {
      projectId,
      items: [
        {
          ticketId: "MOR-1",
          startDate: "2026-10-29",
          dueDate: "2026-10-30T15:00:00+05:30",
        },
        { ticketId: "MOR-2", dueDate: "2026-10-30" },
      ],
    });
    const dated = await run("list_tasks", { projectId });
    expect(
      dated.tasks.map(
        (t: { ticketId: string; startDate: string; dueDate: string }) => [
          t.ticketId,
          t.startDate,
          t.dueDate,
        ],
      ),
    ).toEqual(
      expect.arrayContaining([
        ["MOR-1", "2026-10-29", "2026-10-30T09:30:00.000Z"],
        ["MOR-2", null, "2026-10-30"],
      ]),
    );
    const rule = "DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;BYDAY=FR";
    expect(
      await run("update_tasks", {
        projectId,
        items: [{ ticketId: "MOR-2", recurrence: rule }],
      }),
    ).toEqual([{ index: 0, ticketId: "MOR-2", changed: ["recurrence"] }]);
    const repeated = await run("list_tasks", { projectId });
    expect(
      repeated.tasks.find((t: { ticketId: string }) => t.ticketId === "MOR-2")
        .recurrence,
    ).toBe(rule);
    await run("update_tasks", {
      projectId,
      items: [{ ticketId: "MOR-2", recurrence: null }],
    });
    await run("move_task", {
      projectId,
      ticketId: "MOR-1",
      column: "Review",
      at: "top",
    });
    const { commentId } = await run("comment_task", {
      projectId,
      ticketId: "MOR-1",
      action: "create",
      body: "Looks good",
    });
    await run("comment_task", {
      projectId,
      ticketId: "MOR-1",
      action: "update",
      commentId,
      body: "Looks great",
    });
    const { linkId } = await run("manage_link", {
      projectId,
      ticketId: "MOR-1",
      action: "create",
      url: "https://github.com/acme/app/pull/7",
      title: "PR 7",
    });
    await run("manage_link", {
      projectId,
      ticketId: "MOR-1",
      action: "update",
      linkId,
      title: "Pull request 7",
    });

    const detail = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(detail).toMatchObject({
      title: "First, renamed",
      links: [
        {
          id: linkId,
          url: "https://github.com/acme/app/pull/7",
          title: "Pull request 7",
        },
      ],
      priority: "high",
      column: "Review",
      labels: [],
      comments: [{ body: "Looks great" }],
    });
    const { tasks } = await run("list_tasks", { projectId });
    expect(tasks.map((t: { ticketId: string }) => t.ticketId)).toEqual([
      "MOR-1",
      "MOR-2",
    ]);

    await run("archive_task", { projectId, ticketId: "MOR-2" });
    await run("delete_task", { projectId, ticketId: "MOR-2" });
    await run("update_project", { projectId, archived: true });
    await run("delete_project", { projectId });
    const missing = await call(owner.token, "get_task", {
      workspaceId: workspace.id,
      projectId,
      ticketId: "MOR-1",
    });
    expect(missing.result?.isError).toBe(true);
  });

  it("sets, clears and reports a parent task, refusing loops", async () => {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Tree", slug: "tree-writes", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      return {
        failed: response.result?.isError === true,
        body: JSON.parse(response.result!.content[0].text),
      };
    };
    const { body: project } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });
    const projectId = project.projectId;

    const created = await run("create_tasks", {
      projectId,
      items: [{ title: "Epic" }, { title: "Part", parentId: "MOR-1" }],
    });
    expect(created.body).toEqual([
      { index: 0, ticketId: "MOR-1" },
      { index: 1, ticketId: "MOR-2" },
    ]);

    const epic = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(epic.body).toMatchObject({
      parent: null,
      subtaskDone: 0,
      subtaskTotal: 1,
    });
    const part = await run("get_task", { projectId, ticketId: "MOR-2" });
    expect(part.body.parent).toEqual({ ticketId: "MOR-1", title: "Epic" });
    const listed = await run("list_tasks", { projectId });
    expect(listed.body.tasks).toMatchObject([
      { ticketId: "MOR-1", parent: null, subtasks: { done: 0, total: 1 } },
      { ticketId: "MOR-2", parent: "MOR-1", subtasks: { done: 0, total: 0 } },
    ]);

    const loop = await run("update_tasks", {
      projectId,
      items: [{ ticketId: "MOR-1", parentId: "MOR-2" }],
    });
    expect(loop.body[0].error).toBeTruthy();
    const cleared = await run("update_tasks", {
      projectId,
      items: [{ ticketId: "MOR-2", parentId: null }],
    });
    expect(cleared.body).toEqual([
      { index: 0, ticketId: "MOR-2", changed: ["parentId"] },
    ]);
    const after = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(after.body.subtaskTotal).toBe(0);
  });

  it("adds, reports and removes relations across projects, refusing loops", async () => {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Links", slug: "relation-writes", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      return {
        failed: response.result?.isError === true,
        body: JSON.parse(response.result!.content[0].text),
      };
    };
    const { body: first } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });
    const { body: second } = await run("create_project", {
      name: "Other",
      key: "OTH",
    });
    await run("create_tasks", {
      projectId: first.projectId,
      items: [{ title: "Blocker" }, { title: "Twin" }],
    });
    await run("create_tasks", {
      projectId: second.projectId,
      items: [{ title: "Waiting" }],
    });

    const added = await run("manage_relation", {
      action: "add",
      type: "blocks",
      ticketId: "MOR-1",
      otherTicketId: "OTH-1",
    });
    await run("manage_relation", {
      action: "add",
      type: "related",
      ticketId: "OTH-1",
      otherTicketId: "MOR-2",
    });
    expect(added.failed).toBe(false);

    const waiting = await run("get_task", { ticketId: "OTH-1" });
    expect(waiting.body.relations).toMatchObject([
      { kind: "blocked_by", ticketId: "MOR-1", title: "Blocker" },
      { kind: "related", ticketId: "MOR-2", title: "Twin" },
    ]);
    expect(waiting.body.openBlockerCount).toBe(1);
    const listedBlocked = await run("list_tasks", {});
    expect(
      listedBlocked.body.tasks.find(
        (t: { ticketId: string }) => t.ticketId === "OTH-1",
      ),
    ).toMatchObject({ openBlockers: 1 });
    const loop = await run("manage_relation", {
      action: "add",
      type: "blocks",
      ticketId: "OTH-1",
      otherTicketId: "MOR-1",
    });
    expect(loop.failed).toBe(true);
    expect(loop.body.code).toBe("RELATION_CYCLE");

    const removed = await run("manage_relation", {
      action: "remove",
      type: "blocks",
      ticketId: "MOR-1",
      otherTicketId: "OTH-1",
    });
    expect(removed.failed).toBe(false);
    const after = await run("get_task", { ticketId: "OTH-1" });
    expect(after.body.relations).toMatchObject([{ kind: "related" }]);
    expect(after.body.openBlockerCount).toBe(0);
    const missing = await run("manage_relation", {
      action: "remove",
      type: "blocks",
      ticketId: "MOR-1",
      otherTicketId: "OTH-1",
    });
    expect(missing.failed).toBe(true);
  });

  it("creates and changes tasks in batches, creating missing labels", async () => {
    const owner = await signUp("Owner");
    const viewer = await signUp("Viewer");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Batch", slug: "batch-writes", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values([
      {
        workspaceId: workspace.id,
        userId: owner.user.id,
        role: "owner",
        joinedAt: new Date(),
      },
      {
        workspaceId: workspace.id,
        userId: viewer.user.id,
        role: "viewer",
        joinedAt: new Date(),
      },
    ]);
    const as =
      (who: { token: string }) =>
      async (name: string, args = {}) => {
        const response = await call(who.token, name, {
          workspaceId: workspace.id,
          ...args,
        });
        expect(response.result?.isError, response.result?.content[0].text).toBe(
          false,
        );
        return JSON.parse(response.result!.content[0].text);
      };
    const run = as(owner);
    const { projectId } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });

    const created = await run("create_tasks", {
      projectId,
      items: [
        { title: "Seed", labels: ["Fresh"], description: "needle in text" },
        { title: "Broken", column: "Nowhere" },
        { title: "Mine", assignee: owner.user.email, priority: "high" },
      ],
    });
    expect(created[0]).toEqual({
      index: 0,
      ticketId: "MOR-1",
      createdLabels: ["Fresh"],
    });
    expect(created[1]).toMatchObject({ index: 1 });
    expect(created[1].error).toContain("Nowhere");
    expect(created[2]).toEqual({ index: 2, ticketId: "MOR-2" });

    const updated = await run("update_tasks", {
      projectId,
      items: [
        { ticketId: "MOR-1", addLabels: ["Fresh", "Second"], priority: "low" },
        { ticketId: "MOR-9", title: "Ghost" },
      ],
    });
    expect(updated[0]).toEqual({
      index: 0,
      ticketId: "MOR-1",
      changed: ["priority", "addLabels"],
      createdLabels: ["Second"],
    });
    expect(updated[1]).toMatchObject({ index: 1 });
    const detail = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(detail.title).toBe("Seed");
    expect(detail.priority).toBe("low");
    expect(detail.labels.map((l: { name: string }) => l.name).sort()).toEqual([
      "Fresh",
      "Second",
    ]);

    const titles = async (args: Record<string, unknown>) =>
      (await run("list_tasks", args)).tasks.map(
        (t: { title: string }) => t.title,
      );
    expect(await titles({ projectId, assignee: "me" })).toEqual(["Mine"]);
    expect(await titles({ projectId, assignee: owner.user.email })).toEqual([
      "Mine",
    ]);
    expect(await titles({ projectId, label: "FRESH" })).toEqual(["Seed"]);
    expect(
      await titles({ projectId, column: detail.column.toUpperCase() }),
    ).toEqual(["Seed", "Mine"]);
    expect(await titles({ projectId, query: "NEEDLE" })).toEqual(["Seed"]);
    expect(await titles({ projectId, query: "100%" })).toEqual([]);

    const withText = await run("list_tasks", {
      projectId,
      query: "needle",
      withDescription: true,
    });
    expect(withText.tasks[0]).toMatchObject({
      description: "needle in text",
      labels: expect.arrayContaining(["Fresh"]),
    });
    expect(withText.tasks[0]).not.toHaveProperty("project");

    // Without a project it spans the workspace and names each task's project.
    const second = await run("create_project", { name: "Other", key: "OTH" });
    await run("create_tasks", {
      projectId: second.projectId,
      items: [{ title: "Elsewhere" }],
    });
    const everywhere = await run("list_tasks", {});
    expect(everywhere.tasks).toHaveLength(3);
    expect(everywhere.tasks.map((t: { project: string }) => t.project)).toEqual(
      ["MOR", "MOR", "OTH"],
    );
    const tooNarrow = await call(owner.token, "list_tasks", {
      workspaceId: workspace.id,
      column: "To Do",
    });
    expect(tooNarrow.result?.isError).toBe(true);

    const limited = await run("list_tasks", { limit: 1 });
    expect(limited).toMatchObject({ truncated: true });
    expect(limited.tasks).toHaveLength(1);

    // A role that cannot create labels gets a clear error for that item only.
    const refused = await as(viewer)("update_tasks", {
      projectId,
      items: [{ ticketId: "MOR-2", addLabels: ["Brand new"] }],
    });
    expect(refused[0].error).toContain("may not create labels");
  });

  it("marks a listing cut at 200 tasks as truncated", async () => {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Big", slug: "big-listing", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: workspace.id,
        key: "BIG",
        name: "Big",
        position: "a0",
        lastTaskNumber: 201,
      })
      .returning();
    const [column] = await db
      .insert(schema.projectColumnTable)
      .values({
        projectId: project.id,
        name: "To Do",
        category: "unstarted",
        color: "#64748b",
        position: "a0",
      })
      .returning();
    await db.insert(schema.taskTable).values(
      Array.from({ length: 201 }, (_, index) => ({
        id: `tbig${String(index).padStart(20, "0")}`,
        projectId: project.id,
        columnId: column.id,
        number: index + 1,
        title: `Task ${index + 1}`,
        position: `a${String(index).padStart(4, "0")}`,
      })),
    );

    const response = await call(owner.token, "list_tasks", {
      workspaceId: workspace.id,
      limit: 200,
    });
    const listed = JSON.parse(response.result!.content[0].text);
    expect(listed.tasks).toHaveLength(200);
    expect(listed.truncated).toBe(true);
  });

  it("lists a workspace's projects with their columns in board order", async () => {
    const owner = await signUp("Owner");
    const stranger = await signUp("Stranger");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: workspace.id,
        key: "MOR",
        name: "Morrow",
        position: "a0",
      })
      .returning();
    await db.insert(schema.projectColumnTable).values([
      {
        projectId: project.id,
        name: "Done",
        category: "done",
        color: "#22c55e",
        position: "a0",
      },
      {
        projectId: project.id,
        name: "To Do",
        category: "unstarted",
        color: "#64748b",
        position: "a0",
      },
    ]);

    const listed = await call(owner.token, "list_projects", {
      workspaceId: workspace.id,
    });
    expect(listed.result?.isError).toBe(false);
    const [first] = JSON.parse(listed.result!.content[0].text) as Array<{
      key: string;
      columns: Array<{ name: string }>;
    }>;
    expect(first.key).toBe("MOR");
    expect(first.columns.map((column) => column.name)).toEqual([
      "To Do",
      "Done",
    ]);

    const denied = await call(stranger.token, "list_projects", {
      workspaceId: workspace.id,
    });
    expect(denied.result?.isError).toBe(true);
    expect(denied.result?.content[0].text).not.toContain("Morrow");
  });

  it("lists a project's tasks in board order and refuses a stranger", async () => {
    const owner = await signUp("Owner");
    const stranger = await signUp("Stranger");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared-tasks", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: workspace.id,
        key: "MOR",
        name: "Morrow",
        position: "a0",
        lastTaskNumber: 2,
      })
      .returning();
    const [todo, done] = await db
      .insert(schema.projectColumnTable)
      .values([
        {
          projectId: project.id,
          name: "To Do",
          category: "unstarted",
          color: "#64748b",
          position: "a0",
        },
        {
          projectId: project.id,
          name: "Done",
          category: "done",
          color: "#22c55e",
          position: "a0",
        },
      ])
      .returning();
    await db.insert(schema.taskTable).values([
      {
        id: "tdone000000000000000000a",
        projectId: project.id,
        columnId: done.id,
        number: 1,
        title: "Shipped",
        position: "a0",
        completedAt: new Date(),
      },
      {
        id: "ttodo000000000000000000a",
        projectId: project.id,
        columnId: todo.id,
        number: 2,
        title: "Plan",
        priority: "high",
        assigneeId: owner.user.id,
        dueAt: new Date("2026-12-31T00:00:00Z"),
        position: "a0",
      },
    ]);

    const listed = await call(owner.token, "list_tasks", {
      workspaceId: workspace.id,
      projectId: project.id,
    });
    expect(listed.result?.isError).toBe(false);
    const { tasks, truncated } = JSON.parse(listed.result!.content[0].text);
    expect(truncated).toBe(false);
    expect(tasks[0]).not.toHaveProperty("description");
    expect(tasks.map((task: { ticketId: string }) => task.ticketId)).toEqual([
      "MOR-2",
      "MOR-1",
    ]);
    expect(tasks[0]).toMatchObject({
      title: "Plan",
      column: "To Do",
      category: "unstarted",
      priority: "high",
      assignee: { id: owner.user.id, name: "Owner" },
      dueDate: "2026-12-31",
      completedAt: null,
      archivedAt: null,
    });
    expect(tasks[1].completedAt).not.toBeNull();

    const denied = await call(stranger.token, "list_tasks", {
      workspaceId: workspace.id,
      projectId: project.id,
    });
    expect(denied.result?.isError).toBe(true);
    expect(denied.result?.content[0].text).not.toContain("Plan");
  });

  it("returns a task's labels and comments, and lists labels, for a member only", async () => {
    const owner = await signUp("Owner");
    const stranger = await signUp("Stranger");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Shared", slug: "shared-detail", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const [project] = await db
      .insert(schema.projectTable)
      .values({
        workspaceId: workspace.id,
        key: "MOR",
        name: "Morrow",
        position: "a0",
        lastTaskNumber: 1,
      })
      .returning();
    const [todo] = await db
      .insert(schema.projectColumnTable)
      .values({
        projectId: project.id,
        name: "To Do",
        category: "unstarted",
        color: "#64748b",
        position: "a0",
      })
      .returning();
    const [bug, design] = await db
      .insert(schema.labelTable)
      .values([
        {
          workspaceId: workspace.id,
          name: "Bug",
          color: "#ef4444",
          position: "a0",
        },
        {
          workspaceId: workspace.id,
          name: "Design",
          color: "#8b5cf6",
          position: "a1",
        },
      ])
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        id: "tdetail00000000000000000a",
        projectId: project.id,
        columnId: todo.id,
        number: 1,
        title: "Look closer",
        position: "a0",
        labelIds: [design.id],
        commentCount: 1,
      })
      .returning();
    await db.insert(schema.taskDescriptionTable).values({
      taskId: task.id,
      projectId: project.id,
      description: "Details here",
    });
    await db.insert(schema.taskCommentTable).values({
      id: "cdetail00000000000000000a",
      taskId: task.id,
      projectId: project.id,
      authorId: owner.user.id,
      body: "A remark",
    });

    const labels = await call(owner.token, "list_labels", {
      workspaceId: workspace.id,
    });
    const detail = await call(owner.token, "get_task", {
      workspaceId: workspace.id,
      projectId: project.id,
      ticketId: "mor-1",
    });
    const missing = await call(owner.token, "get_task", {
      workspaceId: workspace.id,
      projectId: project.id,
      ticketId: "MOR-9",
    });
    const deniedLabels = await call(stranger.token, "list_labels", {
      workspaceId: workspace.id,
    });
    const deniedTask = await call(stranger.token, "get_task", {
      workspaceId: workspace.id,
      projectId: project.id,
      ticketId: "MOR-1",
    });

    expect(JSON.parse(labels.result!.content[0].text)).toEqual([
      { name: "Bug", color: "#ef4444" },
      { name: "Design", color: "#8b5cf6" },
    ]);
    expect(bug.name).toBe("Bug");
    const task_ = JSON.parse(detail.result!.content[0].text);
    expect(task_).toMatchObject({
      ticketId: "MOR-1",
      title: "Look closer",
      description: "Details here",
      labels: [{ name: "Design", color: "#8b5cf6" }],
      comments: [
        { author: { id: owner.user.id, name: "Owner" }, body: "A remark" },
      ],
    });
    expect(missing.result?.isError).toBe(true);
    for (const denied of [deniedLabels, deniedTask]) {
      expect(denied.result?.isError).toBe(true);
      expect(denied.result?.content[0].text).not.toContain("A remark");
    }
  });

  it("rejects empty identifiers before running anything", async () => {
    const { token } = await signUp();
    for (const [name, args] of [
      ["list_members", { workspaceId: " " }],
      ["list_activity", { workspaceId: "" }],
    ] as const) {
      expect((await call(token, name, args)).result?.isError).toBe(true);
    }
  });

  it("authenticates every request", async () => {
    const { token } = await signUp();
    expect((await modern(null, "tools/list")).status).toBe(401);
    expect((await modern("invalid-token", "tools/list")).status).toBe(401);
    expect((await modern(token, "tools/list")).status).toBe(200);
  });

  it("refuses a session token and a token for another audience", async () => {
    const { user } = await signUp();
    const { auth } = await import("../../apps/api/src/auth/config");
    const wrongAudience = await auth.api.signJWT({
      body: { payload: { sub: user.id, aud: "somewhere-else" } },
    });
    expect((await modern(wrongAudience.token, "tools/list")).status).toBe(401);
  });

  it("rejects a modern request without the per-request metadata", async () => {
    const { token } = await signUp();
    const response = await app.request("/api/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "mcp-method": "tools/list",
        "mcp-protocol-version": protocolVersion,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(response.status).toBe(400);
  });

  it("answers only POST", async () => {
    const { token } = await signUp();
    const response = await app.request("/api/mcp", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(405);
  });

  it("serves 2025-era clients statelessly, even carrying an old session id", async () => {
    const { token } = await signUp();
    const legacy = (headers: Record<string, string>, body: unknown) =>
      app.request("/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          ...headers,
        },
        body: JSON.stringify(body),
      });

    const initialized = await legacy(
      {},
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "legacy-test", version: "1.0.0" },
        },
      },
    );
    expect(initialized.status).toBe(200);

    const listed = await legacy(
      { "mcp-session-id": "gone-session" },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    );
    expect(listed.status).toBe(200);
    expect((await rpc(listed)).result?.tools).toContainEqual(
      expect.objectContaining({ name: "whoami" }),
    );
  });
});

describe("MCP tools for fields, duplicates and batch changes", () => {
  async function setup() {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Fields", slug: "mcp-fields", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      return {
        failed: response.result?.isError === true,
        body: JSON.parse(response.result!.content[0].text),
      };
    };
    const { body: project } = await run("create_project", {
      name: "Morrow",
      key: "MOR",
    });
    await db.insert(schema.projectFieldTable).values({
      projectId: project.projectId,
      name: "Size",
      type: "single_choice",
      position: "a0",
      options: [
        { id: "opt-small", name: "Small", color: "#22c55e", position: "a0" },
        { id: "opt-large", name: "Large", color: "#ef4444", position: "a1" },
      ],
    });
    return { run, projectId: project.projectId as string };
  }

  it("lists a project's fields with their options", async () => {
    const { run, projectId } = await setup();

    const fields = await run("list_fields", { projectId });

    expect(fields.body).toEqual([
      {
        name: "Size",
        type: "single_choice",
        options: [
          { name: "Small", color: "#22c55e" },
          { name: "Large", color: "#ef4444" },
        ],
      },
    ]);
  });

  it("sets, reports and clears a field value by name, and refuses unknown names per item", async () => {
    const { run, projectId } = await setup();
    await run("create_tasks", {
      projectId,
      items: [{ title: "A", fields: { size: "large" } }, { title: "B" }],
    });

    const created = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(created.body.fields).toEqual({ Size: "Large" });

    const updated = await run("update_tasks", {
      projectId,
      items: [
        { ticketId: "MOR-2", fields: { Size: "Small" } },
        { ticketId: "MOR-2", fields: { Nope: "Small" } },
        { ticketId: "MOR-2", fields: { Size: "Huge" } },
        { ticketId: "MOR-1", fields: { Size: null } },
        { ticketId: "MOR-1", fields: {} },
      ],
    });
    expect(updated.body).toMatchObject([
      { index: 0, ticketId: "MOR-2", changed: ["fields"] },
      { index: 1, error: expect.stringContaining('No field named "Nope"') },
      { index: 2, error: expect.stringContaining('No option "Huge"') },
      { index: 3, ticketId: "MOR-1", changed: ["fields"] },
      { index: 4, error: expect.stringContaining("Nothing to change") },
    ]);

    const listed = await run("list_tasks", { projectId });
    expect(listed.body.tasks).toMatchObject([
      { ticketId: "MOR-1" },
      { ticketId: "MOR-2", fields: { Size: "Small" } },
    ]);
    expect(listed.body.tasks[0]).not.toHaveProperty("fields");
  });

  it("reads and writes text, number, date, checkbox and multi choice fields by name", async () => {
    const { run, projectId } = await setup();
    await db.insert(schema.projectFieldTable).values([
      {
        projectId,
        name: "Points",
        type: "number",
        position: "a1",
        config: { min: 0, max: 20, unit: "pts" },
      },
      { projectId, name: "Note", type: "text", position: "a2" },
      { projectId, name: "Target", type: "date", position: "a3" },
      { projectId, name: "Reviewed", type: "checkbox", position: "a4" },
      {
        projectId,
        name: "Areas",
        type: "multi_choice",
        position: "a5",
        options: [
          { id: "area-api", name: "API", color: "#22c55e", position: "a0" },
          { id: "area-web", name: "Web", color: "#ef4444", position: "a1" },
        ],
      },
    ]);

    const fields = await run("list_fields", { projectId });
    expect(
      fields.body.find((f: { name: string }) => f.name === "Points"),
    ).toEqual({
      name: "Points",
      type: "number",
      config: { min: 0, max: 20, unit: "pts" },
      options: [],
    });

    await run("create_tasks", {
      projectId,
      items: [
        {
          title: "Typed",
          fields: {
            Points: 5,
            Note: "call Ana",
            Target: "2026-11-01",
            Reviewed: true,
            Areas: ["api", "Web"],
          },
        },
        { title: "Other" },
      ],
    });
    const created = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(created.body.fields).toEqual({
      Points: 5,
      Note: "call Ana",
      Target: "2026-11-01",
      Reviewed: true,
      Areas: ["API", "Web"],
    });

    const updated = await run("update_tasks", {
      projectId,
      items: [
        {
          ticketId: "MOR-1",
          fields: { Points: 9, Reviewed: false, Areas: "Web" },
        },
        { ticketId: "MOR-1", fields: { Points: 99 } },
        { ticketId: "MOR-1", fields: { Target: "tomorrow" } },
        { ticketId: "MOR-1", fields: { Areas: ["Nope"] } },
        { ticketId: "MOR-1", fields: { Note: null } },
      ],
    });
    expect(updated.body).toMatchObject([
      { index: 0, ticketId: "MOR-1", changed: ["fields"] },
      { index: 1, error: expect.stringContaining('number field "Points"') },
      { index: 2, error: expect.stringContaining("date") },
      { index: 3, error: expect.stringContaining('No option "Nope"') },
      { index: 4, ticketId: "MOR-1", changed: ["fields"] },
    ]);
    const after = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(after.body.fields).toEqual({
      Points: 9,
      Target: "2026-11-01",
      Areas: ["Web"],
    });
  });

  it("duplicates a task with its description, labels and field values, right after the original", async () => {
    const { run, projectId } = await setup();
    await run("create_tasks", {
      projectId,
      items: [
        {
          title: "Original",
          description: "Details",
          priority: "high",
          labels: ["Bug"],
          fields: { Size: "Large" },
        },
        { title: "Next" },
      ],
    });

    const copy = await run("duplicate_task", { projectId, ticketId: "MOR-1" });
    expect(copy.body).toEqual({ ticketId: "MOR-3", from: "MOR-1" });

    const detail = await run("get_task", { projectId, ticketId: "MOR-3" });
    expect(detail.body).toMatchObject({
      title: "Original (copy)",
      description: "Details",
      priority: "high",
      labels: [{ name: "Bug" }],
      fields: { Size: "Large" },
      completedAt: null,
    });
    const listed = await run("list_tasks", { projectId });
    expect(
      listed.body.tasks.map((t: { ticketId: string }) => t.ticketId),
    ).toEqual(["MOR-1", "MOR-3", "MOR-2"]);
  });

  it("moves tasks in a batch with update_tasks and filters list_tasks by priority and state", async () => {
    const { run, projectId } = await setup();
    await run("create_tasks", {
      projectId,
      items: [
        { title: "A", priority: "urgent" },
        { title: "B", priority: "low" },
        { title: "C", priority: "urgent" },
      ],
    });

    const moved = await run("update_tasks", {
      projectId,
      items: [
        { ticketId: "MOR-1", column: "Done" },
        { ticketId: "MOR-2", column: "Done", at: "top" },
        { ticketId: "MOR-3", column: "Nowhere" },
      ],
    });
    expect(moved.body).toMatchObject([
      { index: 0, changed: ["column"] },
      { index: 1, changed: ["column"] },
      { index: 2, error: expect.stringContaining('No column named "Nowhere"') },
    ]);

    const done = await run("list_tasks", { projectId, column: "Done" });
    expect(
      done.body.tasks.map((t: { ticketId: string }) => t.ticketId),
    ).toEqual(["MOR-2", "MOR-1"]);
    expect(done.body.tasks[0].completedAt).not.toBeNull();

    const closed = await run("list_tasks", { projectId, state: "closed" });
    expect(closed.body.tasks).toHaveLength(2);
    const open = await run("list_tasks", { projectId, state: "open" });
    expect(
      open.body.tasks.map((t: { ticketId: string }) => t.ticketId),
    ).toEqual(["MOR-3"]);
    const urgent = await run("list_tasks", {
      projectId,
      priority: "urgent",
      state: "open",
    });
    expect(
      urgent.body.tasks.map((t: { ticketId: string }) => t.ticketId),
    ).toEqual(["MOR-3"]);
  });

  it("creates a batch of tasks in order at the bottom of a column", async () => {
    const { run, projectId } = await setup();

    await run("create_tasks", {
      projectId,
      items: [
        { title: "One" },
        { title: "Two" },
        { title: "Three", at: "top" },
      ],
    });

    const listed = await run("list_tasks", { projectId });
    expect(listed.body.tasks.map((t: { title: string }) => t.title)).toEqual([
      "Three",
      "One",
      "Two",
    ]);
  });
});

describe("MCP move_tasks", () => {
  async function setup() {
    const owner = await signUp("Owner");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({ name: "Moves", slug: "mcp-moves", createdAt: new Date() })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const response = await call(owner.token, name, {
        workspaceId: workspace.id,
        ...args,
      });
      return {
        failed: response.result?.isError === true,
        body: JSON.parse(response.result!.content[0].text),
      };
    };
    const project = async (key: string) =>
      (await run("create_project", { name: key, key })).body
        .projectId as string;
    return { run, project, workspace };
  }

  it("moves tasks by key and column name from several projects, refusing bad items on their own", async () => {
    const { run, project } = await setup();
    const mor = await project("MOR");
    const thr = await project("THR");
    const web = await project("WEB");
    await run("create_tasks", {
      projectId: mor,
      items: [{ title: "Epic", column: "In Progress" }, { title: "Other" }],
    });
    await run("create_tasks", { projectId: thr, items: [{ title: "Third" }] });
    await run("create_tasks", {
      projectId: mor,
      items: [{ title: "Child", parentId: "MOR-1", column: "Done" }],
    });
    await run("create_tasks", {
      projectId: web,
      items: [{ title: "Resident" }],
    });

    const moved = await run("move_tasks", {
      ticketIds: ["MOR-1", "THR-1", "MOR-99", "NOPE-1", "WEB-1"],
      project: "web",
      column: "Backlog",
    });

    expect(moved.failed).toBe(false);
    expect(moved.body.moved).toEqual([
      { from: "MOR-1", to: "WEB-2", column: "Backlog" },
      // A Subtask follows its own state, not the picked column.
      { from: "MOR-3", to: "WEB-3", column: "Done" },
      { from: "THR-1", to: "WEB-4", column: "Backlog" },
    ]);
    expect(moved.body.refused).toEqual([
      { index: 2, ticketId: "MOR-99", error: "No task MOR-99" },
      {
        index: 3,
        ticketId: "NOPE-1",
        error: expect.stringContaining("No project"),
      },
      { index: 4, ticketId: "WEB-1", error: "WEB-1 is already in WEB" },
    ]);
    const listed = await run("list_tasks", { projectId: web });
    expect(
      listed.body.tasks.map((t: { ticketId: string }) => t.ticketId),
    ).toEqual(["WEB-1", "WEB-2", "WEB-4", "WEB-3"]);
  });

  it("moves subtasks along by default and leaves them behind when asked", async () => {
    const { run, project } = await setup();
    const mor = await project("MOR");
    await project("WEB");
    await run("create_tasks", {
      projectId: mor,
      items: [{ title: "Epic" }, { title: "Piece", parentId: "MOR-1" }],
    });
    await run("create_tasks", {
      projectId: mor,
      items: [{ title: "Epic 2" }, { title: "Piece 2", parentId: "MOR-3" }],
    });

    const along = await run("move_tasks", {
      ticketIds: ["MOR-1"],
      project: "WEB",
    });
    const alone = await run("move_tasks", {
      ticketIds: ["MOR-3"],
      project: "WEB",
      withSubtasks: false,
    });

    expect(along.body.moved.map((t: { to: string }) => t.to)).toEqual([
      "WEB-1",
      "WEB-2",
    ]);
    expect(alone.body.moved).toEqual([
      { from: "MOR-3", to: "WEB-3", column: "Backlog" },
    ]);
    const stayed = await run("get_task", { projectId: mor, ticketId: "MOR-4" });
    expect(stayed.body).toMatchObject({ ticketId: "MOR-4", parent: null });
  });

  it("reports dropped field values and the parent a task left", async () => {
    const { run, project, workspace } = await setup();
    const mor = await project("MOR");
    await project("WEB");
    await db.insert(schema.projectFieldTable).values({
      projectId: mor,
      name: "Size",
      type: "single_choice",
      position: "a0",
      options: [
        { id: "opt-l", name: "Large", color: "#ef4444", position: "a0" },
      ],
    });
    await run("create_tasks", {
      projectId: mor,
      items: [
        { title: "Epic" },
        { title: "Piece", parentId: "MOR-1", fields: { Size: "Large" } },
      ],
    });

    const moved = await run("move_tasks", {
      ticketIds: ["MOR-2"],
      project: "WEB",
    });

    expect(moved.body.moved).toEqual([
      {
        from: "MOR-2",
        to: "WEB-1",
        column: "Backlog",
        droppedFields: [{ field: "Size", value: "Large" }],
        leftParent: "MOR-1",
      },
    ]);
    void workspace;
  });

  it("resolves an old ticket id with get_task and works on the moved task", async () => {
    const { run, project } = await setup();
    const mor = await project("MOR");
    await project("WEB");
    await run("create_tasks", {
      projectId: mor,
      items: [{ title: "Wandering" }],
    });
    await run("move_tasks", { ticketIds: ["MOR-1"], project: "WEB" });

    const viaOld = await run("get_task", { projectId: mor, ticketId: "MOR-1" });
    const comment = await run("comment_task", {
      projectId: mor,
      ticketId: "MOR-1",
      action: "create",
      body: "still here",
    });

    expect(viaOld.body).toMatchObject({
      ticketId: "WEB-1",
      title: "Wandering",
    });
    expect(comment.failed).toBe(false);
  });

  it("refuses an unknown project or column for the whole call", async () => {
    const { run, project } = await setup();
    const mor = await project("MOR");
    await project("WEB");
    await run("create_tasks", { projectId: mor, items: [{ title: "A" }] });

    const noProject = await run("move_tasks", {
      ticketIds: ["MOR-1"],
      project: "ZZZ",
    });
    const noColumn = await run("move_tasks", {
      ticketIds: ["MOR-1"],
      project: "WEB",
      column: "Nowhere",
    });

    expect(noProject.failed).toBe(true);
    expect(noColumn.failed).toBe(true);
    const still = await run("get_task", { projectId: mor, ticketId: "MOR-1" });
    expect(still.body.ticketId).toBe("MOR-1");
  });
});
