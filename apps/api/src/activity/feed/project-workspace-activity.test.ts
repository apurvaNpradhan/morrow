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
});
