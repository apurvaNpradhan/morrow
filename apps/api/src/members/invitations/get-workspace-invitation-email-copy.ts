import enUS from "@morrow/i18n/en-US.json" with { type: "json" };

export function getWorkspaceInvitationEmailCopy(_locale?: string | null) {
  return enUS.invitations.email;
}
