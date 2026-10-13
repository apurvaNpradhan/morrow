import type { FooterLink } from "./email-footer";

/** The instance's privacy page, when the sender knows the instance URL. */
export function footerLinks(
  instanceUrl: string | undefined,
  privacyLabel: string,
): FooterLink[] {
  if (!instanceUrl) return [];
  return [
    { label: privacyLabel, href: `${instanceUrl.replace(/\/$/, "")}/privacy` },
  ];
}

export function instanceHost(instanceUrl: string | undefined) {
  if (!instanceUrl) return undefined;
  try {
    return new URL(instanceUrl).host;
  } catch {
    return undefined;
  }
}
