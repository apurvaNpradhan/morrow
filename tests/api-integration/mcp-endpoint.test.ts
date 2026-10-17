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
      "create_task",
      "delete_project",
      "delete_task",
      "get_task",
      "list_activity",
      "list_labels",
      "list_members",
      "list_projects",
      "list_tasks",
      "list_workspaces",
      "manage_column",
      "manage_label",
      "move_task",
      "update_project",
      "update_task",
      "whoami",
    ]);
    expect((await rpc(second)).result?.tools).toHaveLength(19);
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
    await run("manage_label", { action: "create", name: "Bug", color: "red" });
    await run("manage_column", {
      projectId,
      action: "create",
      name: "Review",
      category: "started",
    });
    const first = await run("create_task", {
      projectId,
      title: "First",
      labels: ["bug"],
    });
    const second = await run("create_task", {
      projectId,
      title: "Second",
      column: "review",
      assignee: owner.user.email,
    });
    expect([first.ticketId, second.ticketId]).toEqual(["MOR-1", "MOR-2"]);

    await run("update_task", {
      projectId,
      ticketId: "MOR-1",
      title: "First, renamed",
      priority: "high",
      removeLabels: ["Bug"],
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
      action: "add",
      body: "Looks good",
    });
    await run("comment_task", {
      projectId,
      ticketId: "MOR-1",
      action: "edit",
      commentId,
      body: "Looks great",
    });

    const detail = await run("get_task", { projectId, ticketId: "MOR-1" });
    expect(detail).toMatchObject({
      title: "First, renamed",
      priority: "high",
      column: "Review",
      labels: [],
      comments: [{ body: "Looks great" }],
    });
    const tasks = await run("list_tasks", { projectId });
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
        color: "green",
        position: "a0",
      },
      {
        projectId: project.id,
        name: "To Do",
        category: "unstarted",
        color: "slate",
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
          color: "slate",
          position: "a0",
        },
        {
          projectId: project.id,
          name: "Done",
          category: "done",
          color: "green",
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
        dueDate: "2026-12-31",
        position: "a0",
      },
    ]);

    const listed = await call(owner.token, "list_tasks", {
      workspaceId: workspace.id,
      projectId: project.id,
    });
    expect(listed.result?.isError).toBe(false);
    const tasks = JSON.parse(listed.result!.content[0].text);
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
        color: "slate",
        position: "a0",
      })
      .returning();
    const [bug, design] = await db
      .insert(schema.labelTable)
      .values([
        {
          workspaceId: workspace.id,
          name: "Bug",
          color: "red",
          position: "a0",
        },
        {
          workspaceId: workspace.id,
          name: "Design",
          color: "violet",
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
      { name: "Bug", color: "red" },
      { name: "Design", color: "violet" },
    ]);
    expect(bug.name).toBe("Bug");
    const task_ = JSON.parse(detail.result!.content[0].text);
    expect(task_).toMatchObject({
      ticketId: "MOR-1",
      title: "Look closer",
      description: "Details here",
      labels: [{ name: "Design", color: "violet" }],
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
