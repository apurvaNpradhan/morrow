import React from "react";
import { type DetailRow, DetailRows } from "../components/detail-rows";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import { footerLinks } from "../components/footer-links";
import { formatDate } from "../components/format-date";
import { Frame } from "../components/frame";
import { InvitationCard } from "../components/invitation-card";
import { interpolate } from "./interpolate";

void React;

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  /** Who the invitation was sent to; named in the footer so a stray copy is explained. */
  inviteeEmail?: string;
  /** Already translated, e.g. "Admin". */
  roleLabel?: string;
  expiresAt?: Date | string;
  /** The instance's public URL, for the privacy link. */
  instanceUrl?: string;
  copy?: WorkspaceInvitationEmailCopy;
};

export type WorkspaceInvitationEmailCopy = {
  subject: string;
  preview: string;
  title: string;
  subtitle: string;
  cta: string;
  cardDescription: string;
  fallbackLabel: string;
  detailsTitle: string;
  invitedBy: string;
  role: string;
  expires: string;
  sameEmail: string;
  ignore: string;
  footer: string;
  reason: string;
  privacy: string;
};

// Inlined rather than imported from i18n/en-US.json: this package builds with
// tsc, so the import would survive into dist and resolve outside the published
// files at runtime.
const DEFAULT_COPY: WorkspaceInvitationEmailCopy = {
  subject: "{{inviterName}} invited you to join {{workspaceName}} on Morrow",
  preview: "You're invited to {{workspaceName}} on Morrow",
  title: "Join {{workspaceName}}",
  subtitle:
    "{{inviterName}} ({{inviterEmail}}) invited you to collaborate in Morrow.",
  cta: "Accept invitation",
  cardDescription: "Accept to join this workspace.",
  fallbackLabel: "Or paste this link into your browser",
  detailsTitle: "Invitation details",
  invitedBy: "Invited by",
  role: "Role",
  expires: "Expires",
  sameEmail: "You can accept with the same email that received this message.",
  ignore: "If this wasn't expected, you can safely ignore this email.",
  footer: "Morrow workspace invitation",
  reason:
    "{{inviteeEmail}} was invited to {{workspaceName}} by {{inviterName}}.",
  privacy: "Privacy",
};

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  inviteeEmail,
  roleLabel,
  expiresAt,
  instanceUrl,
  copy = DEFAULT_COPY,
}: WorkspaceInvitationEmailProps) => {
  const values = {
    workspaceName,
    inviterName,
    inviterEmail,
    inviteeEmail: inviteeEmail ?? "",
  };
  const rows: DetailRow[] = [
    { label: copy.invitedBy, value: `${inviterName} (${inviterEmail})` },
    { label: copy.role, value: roleLabel },
    {
      label: copy.expires,
      value: expiresAt ? formatDate(expiresAt, "en") : undefined,
    },
  ].filter((row) => Boolean(row.value));

  return (
    <EmailShell
      title={interpolate(copy.title, values)}
      preview={interpolate(copy.preview, values)}
    >
      <EmailIntro
        title={interpolate(copy.title, values)}
        subtitle={interpolate(copy.subtitle, values)}
      />
      {/* The link carries no address: query strings end up in logs and Referer headers. */}
      <InvitationCard
        workspaceName={workspaceName}
        description={copy.cardDescription}
        cta={copy.cta}
        href={invitationLink}
      />
      <FallbackLink label={copy.fallbackLabel} href={invitationLink} />
      {rows.length > 0 ? (
        <Frame title={copy.detailsTitle} panelPadding="8px 20px">
          <DetailRows rows={rows} />
        </Frame>
      ) : null}
      <EmailNote>
        {copy.sameEmail} {copy.ignore}
      </EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={inviteeEmail ? interpolate(copy.reason, values) : undefined}
        links={footerLinks(instanceUrl, copy.privacy)}
      />
    </EmailShell>
  );
};

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  inviteeEmail: "maya@example.com",
  roleLabel: "Member",
  expiresAt: "2026-10-19T00:00:00.000Z",
  invitationLink: "https://morrow.example.com/invitation/accept/abc123",
  instanceUrl: "https://morrow.example.com",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
