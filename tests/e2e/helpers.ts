import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** The disposable stack's Morrow log; emails are written to it (no Resend key). */
function morrowLogs() {
  return execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "tests/e2e/compose.yml",
      "logs",
      "--no-log-prefix",
      "morrow",
    ],
    {
      cwd: new URL("../..", import.meta.url).pathname,
      encoding: "utf8",
      // The log grows with every request of the run; the default 1 MB overflows.
      maxBuffer: 256 * 1024 * 1024,
    },
  );
}

/** The sign-in code in the newest email to `to`. */
export function consoleEmailCode(to: string) {
  const logs = morrowLogs();
  const start = logs.lastIndexOf(`[morrow-email] to=${to} `);
  if (start === -1) return undefined;
  return logs
    .slice(start)
    .match(/(\d{6}) is your Morrow verification code/)?.[1];
}

/** The invitation id in the newest invitation email to `to`. */
export function consoleInvitationId(to: string) {
  const logs = morrowLogs();
  const start = logs.lastIndexOf(`[morrow-email] to=${to} `);
  if (start === -1) return undefined;
  return logs.slice(start).match(/\/invitation\/accept\/([A-Za-z0-9_-]+)/)?.[1];
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

/**
 * Sign-in codes are rate limited per client address, so each user the tests
 * create arrives from its own made-up one (see TRUSTED_PROXIES in compose.yml).
 */
async function giveOwnClientAddress(page: Page) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.${octet()}.${octet()}`,
  });
}

/** Signs up with an emailed code and answers the name step. Ends on the next onboarding step. */
export async function signUp(page: Page, email: string, name: string) {
  await giveOwnClientAddress(page);
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send Verification Code", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/verify-otp/);

  await expect.poll(() => consoleEmailCode(email)).toBeTruthy();
  await page
    .locator('input[autocomplete="one-time-code"]')
    .pressSequentially(consoleEmailCode(email) as string);

  await expect(page).toHaveURL(/\/onboarding\/you/);
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

/** Creates the first workspace (after `signUp`) and skips inviting. Returns its slug. */
export async function createWorkspace(page: Page, name: string) {
  await expect(page).toHaveURL(/\/onboarding\/workspace/);
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Workspace name", { exact: true }).fill(name);
  await page.getByLabel("URL", { exact: true }).fill(slug);
  await expect(page.getByText("This URL is available")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/invite/);
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/?$`));
  return slug;
}

/** Invites `email` from the members page of `slug`. Returns the invitation id. */
export async function invite(page: Page, slug: string, email: string) {
  await page.goto(`/${slug}/members`);
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await expect(page.getByText("Invitation created")).toBeVisible();
  await expect.poll(() => consoleInvitationId(email)).toBeTruthy();
  await page.getByRole("button", { name: "Done" }).click();
  return consoleInvitationId(email) as string;
}

/** Signs up as `email`, accepts an invitation and lands in the workspace. */
export async function joinWorkspace(
  page: Page,
  email: string,
  name: string,
  slug: string,
  invitationId: string,
) {
  await signUp(page, email, name);
  await page.goto(`/invitation/accept/${invitationId}`);
  await expect(page).toHaveURL(new RegExp(`/${slug}|/onboarding`));
  await page.goto(`/${slug}/members`);
  await expect(page.getByText(email)).toBeVisible();
}
