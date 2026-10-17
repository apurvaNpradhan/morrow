import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { newCommentId } from "./helpers/comments";
import { as } from "./helpers/projects";
import { newTaskId, positionAt } from "./helpers/tasks";
import type { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();

beforeEach(resetTestDatabase);

describe("account.export", () => {
  it("rejects an unauthenticated call", async () => {
    mockAnonymousSession();
    const error = await createTestClient(app)
      .account.export()
      .catch((e: unknown) => e);
    expect((error as ORPCError<string, unknown>).code).toBe("UNAUTHORIZED");
  });

  it("returns the caller's own data, omits others", async () => {
    const { user, workspace } = await createWorkspaceMember({
      workspaceName: "Alpha",
    });
    const other = await createWorkspaceMember();
    await db.insert(schema.activityTable).values([
      {
        workspaceId: workspace.id,
        resourceType: "workspace",
        resourceId: workspace.id,
        type: "workspace_updated",
        actorUserId: user.id,
        content: "I did it",
        eventData: {},
      },
      {
        workspaceId: other.workspace.id,
        resourceType: "workspace",
        resourceId: other.workspace.id,
        type: "workspace_updated",
        actorUserId: other.user.id,
        content: "They did it",
        eventData: {},
      },
    ]);
    mockAuthenticatedSession(user);

    const data = await createTestClient(app).account.export();

    expect(data.profile?.email).toBe(user.email);
    expect(data.memberships.map((m) => m.workspaceName)).toEqual(["Alpha"]);
    expect(data.activity.map((a) => a.content)).toEqual(["I did it"]);
  });

  it("includes the projects and columns of the caller's workspaces, not others'", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(user);
    const client = createTestClient(app);
    await client.projects.create({
      workspaceId: workspace.id,
      name: "Morrow",
      key: "MOR",
      icon: "Rocket",
    });
    mockAuthenticatedSession(other.user);
    await createTestClient(app).projects.create({
      workspaceId: other.workspace.id,
      name: "Secret",
      key: "SEC",
    });
    mockAuthenticatedSession(user);

    const data = await client.account.export();

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({
      workspaceId: workspace.id,
      key: "MOR",
      name: "Morrow",
      icon: "Rocket",
      archivedAt: null,
    });
    expect(data.projects[0]?.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "To Do",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });
  it("includes the tasks of the caller's workspaces, not others'", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    const mine = await setupTasksIn(
      user,
      workspace.id,
      "MOR",
      "Plan the launch",
    );
    const theirs = await setupTasksIn(
      other.user,
      other.workspace.id,
      "SEC",
      "Secret plan",
    );
    expect(theirs.number).toBe(1);
    mockAuthenticatedSession(user);

    const data = await createTestClient(app).account.export();

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({
      workspaceId: workspace.id,
      ticketId: "MOR-1",
      title: "Plan the launch",
      column: "To Do",
      assignedToYou: true,
    });
    expect(mine.number).toBe(1);
  });

  it("includes the comments the caller wrote, not other people's", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const colleague = await addWorkspaceMember(workspace.id, "member");
    const task = await setupTasksIn(user, workspace.id, "MOR", "Plan");
    const [project] = await db.select().from(schema.projectTable);
    const target = {
      workspaceId: workspace.id,
      projectId: project!.id,
      taskId: task.id,
    };
    await as(user).comments.create({
      ...target,
      id: newCommentId(),
      body: "My own words",
    });
    await as(colleague).comments.create({
      ...target,
      id: newCommentId(),
      body: "Someone else's words",
    });
    mockAuthenticatedSession(user);

    const data = await createTestClient(app).account.export();

    expect(data.comments).toHaveLength(1);
    expect(data.comments[0]).toMatchObject({
      workspaceId: workspace.id,
      ticketId: "MOR-1",
      taskTitle: "Plan",
      body: "My own words",
      editedAt: null,
    });
    expect(JSON.stringify(data)).not.toContain("Someone else's words");
  });
});

/** A project with one task assigned to the user, made through the API. */
async function setupTasksIn(
  user: Parameters<typeof as>[0],
  workspaceId: string,
  key: string,
  title: string,
) {
  const client = as(user);
  const project = await client.projects.create({
    workspaceId,
    name: key,
    key,
  });
  const [column] = (
    await client.projects.list({ workspaceId })
  )[0]!.columns.filter((candidate) => candidate.name === "To Do");
  return client.tasks.create({
    workspaceId,
    projectId: project.id,
    id: newTaskId(),
    columnId: column!.id,
    position: positionAt(0),
    title,
    assigneeId: user.id,
  });
}
