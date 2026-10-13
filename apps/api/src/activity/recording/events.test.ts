import { describe, expect, it } from "vite-plus/test";
import { parseWorkspaceActivityEvent } from "./events";

describe("workspace activity event contracts", () => {
  it("keeps invitation activity free of addresses and invitation secrets", () => {
    const event = parseWorkspaceActivityEvent({
      type: "workspace.invitation_created",
      workspaceId: "workspace-a",
      invitationId: "invite-a",
      role: "member",
      email: "private@example.com",
      token: "secret-token",
      invitationUrl: "https://example.test/invitation/secret-token",
    });

    expect(event).toEqual({
      type: "workspace.invitation_created",
      workspaceId: "workspace-a",
      invitationId: "invite-a",
      role: "member",
    });
  });

  it("rejects workspace events without their resource identity", () => {
    expect(() =>
      parseWorkspaceActivityEvent({
        type: "workspace.member_removed",
        workspaceId: "workspace-a",
        memberName: "A member",
      }),
    ).toThrow();
  });
});
