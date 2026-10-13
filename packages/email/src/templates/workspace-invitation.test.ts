import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import enUS from "@morrow/i18n/en-US.json";
import WorkspaceInvitationEmail from "./workspace-invitation";

describe("WorkspaceInvitationEmail", () => {
  it("renders English invitation copy", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://morrow.example.com/invite/abc123",
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toContain("Join Acme Inc");
    expect(html).toContain("Accept invitation");
  });

  it("shows the role, the inviter and when the invitation expires", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        inviteeEmail: "maya@example.com",
        invitationLink: "https://morrow.example.com/invite/abc123",
        roleLabel: "Admin",
        expiresAt: "2026-10-19T00:00:00.000Z",
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toContain("Admin");
    expect(html).toContain("John Doe (john@acme.com)");
    expect(html).toContain("Oct 19, 2026");
    expect(html).toContain("maya@example.com was invited to Acme Inc");
  });

  it("renders without a copy prop so previews and exports work", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://morrow.example.com/invite/abc123",
      }),
    );

    expect(html).toContain("Join Acme Inc");
    expect(html).toContain("Accept invitation");
  });
});
