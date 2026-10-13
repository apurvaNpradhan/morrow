import React from "react";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { footerLinks, instanceHost } from "../components/footer-links";
import { OtpCode } from "../components/otp-code";
import {
  type RequestContext,
  RequestDetails,
  type RequestDetailsCopy,
} from "../components/request-details";
import { OTP_EXPIRY_SECONDS } from "../otp-expiry";
import { interpolate } from "./interpolate";

void React;

export type OtpEmailCopy = {
  preview: string;
  title: string;
  subtitle: string;
  codeLabel: string;
  code: string;
  expiry: string;
  ignoreTitle: string;
  ignore: string;
  footer: string;
  /** `Sent to {{email}} because someone asked to sign in to {{instance}}.` */
  reason: string;
  privacy: string;
};

export type OtpEmailProps = Omit<RequestContext, "instance"> & {
  otp: string;
  /** From `emails.otp` in i18n/en-US.json, which is the only source of this text. */
  copy: OtpEmailCopy;
  /** From `emails.requestDetails`. */
  requestCopy: RequestDetailsCopy;
  /** The instance's public URL, for the host shown in the details and the privacy link. */
  instanceUrl?: string;
};

const OtpEmail = ({
  otp,
  copy,
  requestCopy,
  instanceUrl,
  email,
  requestedAt,
  device,
}: OtpEmailProps) => {
  const instance = instanceHost(instanceUrl);
  const minutes = String(OTP_EXPIRY_SECONDS / 60);

  return (
    <EmailShell
      title={copy.title}
      preview={interpolate(copy.preview, { minutes })}
    >
      <EmailIntro title={copy.title} subtitle={copy.subtitle} />
      <OtpCode
        code={otp}
        label={copy.codeLabel}
        hint={`${otp} ${copy.code} ${interpolate(copy.expiry, { minutes })}`}
      />
      <RequestDetails
        copy={requestCopy}
        email={email}
        instance={instance}
        requestedAt={requestedAt}
        device={device}
      />
      <EmailNote title={copy.ignoreTitle}>{copy.ignore}</EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={
          email
            ? interpolate(copy.reason, {
                email,
                instance: instance ?? "Morrow",
              })
            : undefined
        }
        links={footerLinks(instanceUrl, copy.privacy)}
      />
    </EmailShell>
  );
};

// Preview-only sample for `email dev`; sent mail always gets the i18n copy.
OtpEmail.PreviewProps = {
  otp: "482913",
  email: "maya@example.com",
  instanceUrl: "https://morrow.example.com",
  requestedAt: "2026-10-11T14:12:00.000Z",
  device: { browser: "Safari", os: "iPhone" },
  requestCopy: {
    title: "Request details",
    account: "Account",
    instance: "Instance",
    requested: "Requested",
    device: "Device",
    browserOn: "{{browser}} on {{os}}",
  },
  copy: {
    preview:
      "Enter it on the sign-in page to continue. It expires in {{minutes}} minutes.",
    title: "Sign in to Morrow",
    subtitle:
      "Enter this code on the sign-in page to finish signing in. It works once.",
    codeLabel: "Verification code",
    code: "is your Morrow verification code.",
    expiry: "This code expires in {{minutes}} minutes.",
    ignoreTitle: "Didn't try to sign in?",
    ignore:
      "You can ignore this email. Nobody can get into your account without this code. Morrow will never ask you to share it.",
    footer: "Morrow security email",
    reason:
      "Sent to {{email}} because someone asked to sign in to {{instance}}.",
    privacy: "Privacy",
  },
} as OtpEmailProps;

export default OtpEmail;
