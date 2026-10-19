import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { createWorkspaceMember } from "./helpers/fixtures";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

/** Fakes the one outgoing call (to Electric) and records the URL it was given. */
function fakeElectric(response?: Response) {
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => response ?? new Response("[]"));
  return {
    upstream() {
      const url = spy.mock.calls[0]?.[0];
      if (!(url instanceof URL)) throw new Error("Electric was not called");
      return url;
    },
    called: () => spy.mock.calls.length > 0,
  };
}

const { app } = createApp();
const get = (path: string) => app.request(`/api/shapes/${path}`);

describe("shape proxy", () => {
  it("rejects a request without a session", async () => {
    mockAnonymousSession();
    const electric = fakeElectric();

    const response = await get("workspace-members?offset=-1");

    expect(response.status).toBe(401);
    expect(electric.called()).toBe(false);
  });

  it("answers an unknown shape with 404", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    const response = await get("sessions?offset=-1");

    expect(response.status).toBe(404);
    expect(electric.called()).toBe(false);
  });

  it("sets table, columns, filter and secret from the server", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    const response = await get("workspace-members?offset=-1");
    const upstream = electric.upstream();

    expect(response.status).toBe(200);
    expect(upstream.origin).toBe("http://electric.test:3000");
    expect(upstream.pathname).toBe("/v1/shape");
    expect(upstream.searchParams.get("table")).toBe("workspace_member");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,workspace_id,user_id,role,joined_at",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
    expect(upstream.searchParams.get("secret")).toBe("test-electric-secret");
  });

  it("only sends the user columns that are safe to share", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await get("workspace-member-users?offset=-1");
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("user");
    expect(upstream.searchParams.get("columns")).toBe("id,name,email,image");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the user's workspaces by membership", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await get("workspaces?offset=-1");
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("workspace");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,name,slug,logo,description,created_at",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
    // ...and those whose pending invitation names the user's email.
    expect(upstream.searchParams.get("params[2]")).toBe(user.email);
  });

  it("serves projects, archived ones included, of the user's workspaces", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await get("projects?offset=-1");
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("project");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,workspace_id,key,name,description,icon,color,background_url,archived_at,position,created_at",
    );
    expect(upstream.searchParams.get("where")).toBe(
      "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    );
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the columns of those projects only", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/project-columns?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("project_column");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,project_id,name,category,color,position,created_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toContain(
      "project_id IN (SELECT id FROM project WHERE workspace_id IN (",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the tasks of those projects only, with every column", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/tasks?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          columns: "id,email",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("task");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,project_id,column_id,number,title,checklist_done,checklist_total,priority,assignee_id,due_date,label_ids,field_values,comment_count,position,completed_at,archived_at,created_by,created_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toContain(
      "project_id IN (SELECT id FROM project WHERE workspace_id IN (",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the fields of those projects only, in full, with no way to narrow", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/project-fields?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          columns: "id,email",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("project_field");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,project_id,name,type,position,options,created_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toBe(
      "project_id IN (SELECT id FROM project WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1))",
    );
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
    // Eager: the proxy never asks Electric for a subset of it.
    expect(upstream.searchParams.get("subset__where")).toBeNull();
  });

  it("serves the labels of the user's workspaces only", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/labels?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("label");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,workspace_id,name,color,position,created_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toBe(
      "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    );
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the comments of those projects only, narrowed by the client's subset, never widened", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/task-comments?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          columns: "id,email",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("task_comment");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,task_id,project_id,author_id,body,created_at,edited_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toContain(
      "project_id IN (SELECT id FROM project WHERE workspace_id IN (",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves the links of those projects only, never widened", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/task-links?" +
        new URLSearchParams({
          offset: "-1",
          table: "user",
          columns: "id,email",
          where: "true",
          "params[1]": "someone-else",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("task_link");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,task_id,project_id,url,title,created_at,updated_at",
    );
    expect(upstream.searchParams.get("where")).toContain(
      "project_id IN (SELECT id FROM project WHERE workspace_id IN (",
    );
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves only pending invitations of the user's workspaces", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await get("workspace-invitations?offset=-1");
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("invitation");
    expect(upstream.searchParams.get("columns")).toBe(
      "id,workspace_id,email,role,status,expires_at,created_at,inviter_id",
    );
    expect(upstream.searchParams.get("where")).toContain("status = 'pending'");
    expect(upstream.searchParams.get("where")).toContain("user_id = $1");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
  });

  it("serves invitations addressed to the session email, never another", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await app.request(
      "/api/shapes/my-invitations?" +
        new URLSearchParams({
          offset: "-1",
          "params[1]": "victim@example.com",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("table")).toBe("invitation");
    expect(upstream.searchParams.get("where")).toContain("status = 'pending'");
    expect(upstream.searchParams.get("where")).toContain(
      "lower(email) = lower($1)",
    );
    expect(upstream.searchParams.get("params[1]")).toBe(user.email);
  });

  it("matches no invitations until the user's email is verified", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession({ ...user, emailVerified: false });
    const electric = fakeElectric();

    await get("my-invitations?offset=-1");

    expect(electric.upstream().searchParams.get("params[1]")).toBe("");
  });

  it("forwards protocol parameters and ignores table, where and columns from the client", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const electric = fakeElectric();

    await get(
      "workspace-members?" +
        new URLSearchParams({
          offset: "0_0",
          handle: "h-1",
          live: "true",
          table: "session",
          where: "true",
          columns: "token",
          "params[1]": "someone-else",
          secret: "guess",
        }),
    );
    const upstream = electric.upstream();

    expect(upstream.searchParams.get("offset")).toBe("0_0");
    expect(upstream.searchParams.get("handle")).toBe("h-1");
    expect(upstream.searchParams.get("live")).toBe("true");
    expect(upstream.searchParams.get("table")).toBe("workspace_member");
    expect(upstream.searchParams.get("where")).not.toBe("true");
    expect(upstream.searchParams.get("columns")).not.toContain("token");
    expect(upstream.searchParams.get("params[1]")).toBe(user.id);
    expect(upstream.searchParams.get("secret")).toBe("test-electric-secret");
  });

  it("streams the response back without re-encoding it", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    fakeElectric(
      new Response('[{"headers":{"control":"snapshot-end"}}]', {
        headers: {
          "content-type": "application/json",
          "content-encoding": "gzip",
          "content-length": "9999",
          "electric-handle": "h-1",
          "electric-offset": "0_0",
        },
      }),
    );

    const response = await app.request("/api/shapes/workspace-members", {
      headers: { "accept-encoding": "gzip, br" },
    });

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("electric-handle")).toBe("h-1");
    expect(await response.text()).toBe(
      '[{"headers":{"control":"snapshot-end"}}]',
    );
  });
});
