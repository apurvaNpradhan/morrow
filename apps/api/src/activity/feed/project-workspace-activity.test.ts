import { describe, expect, it } from "vite-plus/test";
import { parseWorkspaceActivityEvent } from "#api/activity/recording/events";
import {
  projectStoredWorkspaceActivity,
  projectWorkspaceActivity,
} from "./project-workspace-activity";

describe("workspace activity public projection", () => {
  it("never exposes invitation ID, email, or acceptance token", () => {
    const event = parseWorkspaceActivityEvent({
      type: "workspace.invitation_created",
      workspaceId: "workspace-1",
      invitationId: "acceptance-capability",
      role: "member",
      email: "private@example.com",
      token: "private-token",
    });
    const projected = projectWorkspaceActivity(event);
    expect(projected).toEqual({
      resourceType: "workspace",
      resourceId: "workspace-1",
      eventData: { role: "member" },
    });
    expect(JSON.stringify(projected)).not.toContain("acceptance-capability");
    expect(JSON.stringify(projected)).not.toContain("private@example.com");
    expect(JSON.stringify(projected)).not.toContain("private-token");
  });

  it("protects invitation rows already stored with private resource and event data", () => {
    const projected = projectStoredWorkspaceActivity({
      workspaceId: "workspace-1",
      resourceType: "invitation",
      resourceId: "acceptance-capability",
      type: "workspace.invitation_created",
      eventData: {
        invitationId: "acceptance-capability",
        email: "private@example.com",
        token: "private-token",
        role: "member",
      },
    });
    expect(projected).toEqual({
      resourceType: "workspace",
      resourceId: "workspace-1",
      eventData: { role: "member" },
    });
    expect(JSON.stringify(projected)).not.toContain("acceptance-capability");
    expect(JSON.stringify(projected)).not.toContain("private@example.com");
    expect(JSON.stringify(projected)).not.toContain("private-token");
  });

  it("points project events at the project and keeps only its key and name", () => {
    const event = parseWorkspaceActivityEvent({
      type: "project.archived",
      workspaceId: "workspace-1",
      projectId: "project-1",
      projectKey: "MOR",
      projectName: "Morrow",
      backgroundUrl: "https://example.test/private.png",
    });

    expect(projectWorkspaceActivity(event)).toEqual({
      resourceType: "project",
      resourceId: "project-1",
      eventData: { projectKey: "MOR", projectName: "Morrow" },
    });
  });

  it("records the old and new key when a key changes", () => {
    const event = parseWorkspaceActivityEvent({
      type: "project.key_changed",
      workspaceId: "workspace-1",
      projectId: "project-1",
      previousKey: "OLD",
      projectKey: "NEW",
    });

    expect(projectWorkspaceActivity(event).eventData).toEqual({
      previousKey: "OLD",
      projectKey: "NEW",
    });
  });

  it("filters stored project rows to the allowed fields", () => {
    expect(
      projectStoredWorkspaceActivity({
        workspaceId: "workspace-1",
        resourceType: "project",
        resourceId: "project-1",
        type: "project.created",
        eventData: { projectKey: "MOR", projectName: "Morrow", extra: "x" },
      }),
    ).toEqual({
      resourceType: "project",
      resourceId: "project-1",
      eventData: { projectKey: "MOR", projectName: "Morrow" },
    });
  });
});
