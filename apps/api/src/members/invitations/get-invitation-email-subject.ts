import { getWorkspaceInvitationEmailCopy } from "./get-workspace-invitation-email-copy";

export function getInvitationEmailSubject(
  locale: string | null,
  inviterName: string,
  workspaceName: string,
) {
  const values = new Map([
    ["inviterName", inviterName],
    ["workspaceName", workspaceName],
  ]);

  return getWorkspaceInvitationEmailCopy(locale).subject.replace(
    /\{\{(\w+)\}\}/g,
    (_match: string, key: string) => values.get(key) ?? "",
  );
}
