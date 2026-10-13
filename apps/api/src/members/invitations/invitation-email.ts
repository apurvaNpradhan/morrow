import { sendWorkspaceInvitationEmail } from "@morrow/email";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { getUserLocale } from "#api/account/index";
import { config } from "#api/platform/config";
import enUS from "@morrow/i18n/en-US.json" with { type: "json" };
import { getInvitationEmailSubject } from "./get-invitation-email-subject";
import { getWorkspaceInvitationEmailCopy } from "./get-workspace-invitation-email-copy";

const roleLabels = new Map(Object.entries(enUS.team.roles));

/** Built-in roles read as "Admin"; custom roles keep their own name. */
function getRoleLabel(role: string) {
  return role
    .split(",")
    .map((name) => roleLabels.get(name.trim()) ?? name.trim())
    .join(", ");
}

/**
 * Emails the invitee. Runs for every send, including resends, so it does
 * nothing else: the activity entry and in-app notification belong to
 * `recordInvitationCreated`, which runs once per invitation.
 */
export const sendInvitationEmail: NonNullable<
  OrganizationOptions["sendInvitationEmail"]
> = async (data) => {
  const inviteLink = `${config.clientUrl}/invitation/accept/${data.id}`;
  const locale = await getUserLocale(data.email);
  const copy = getWorkspaceInvitationEmailCopy(locale);

  await sendWorkspaceInvitationEmail(
    data.email,
    getInvitationEmailSubject(
      locale,
      data.inviter.user.name,
      data.organization.name,
    ),
    {
      inviterEmail: data.inviter.user.email,
      inviterName: data.inviter.user.name,
      workspaceName: data.organization.name,
      invitationLink: inviteLink,
      inviteeEmail: data.email,
      roleLabel: getRoleLabel(data.role),
      expiresAt: data.invitation.expiresAt,
      instanceUrl: config.clientUrl,
      copy,
    },
  );
};
