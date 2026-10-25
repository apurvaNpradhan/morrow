import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  expect,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

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

/** An admin who owns a workspace and a second member, each in their own browser. */
export async function twoPeople(browser: Browser, label: string) {
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();

  // Addresses are lower-cased by the server, so its log (which the helpers read) is too.
  const prefix = label.toLowerCase();
  const memberEmail = uniqueEmail(`${prefix}-member`);
  await signUp(admin, uniqueEmail(`${prefix}-admin`), `${label} Admin`);
  const slug = await createWorkspace(admin, `${label} Space`);
  const invitationId = await invite(admin, slug, memberEmail);
  await joinWorkspace(
    member,
    memberEmail,
    `${label} Member`,
    slug,
    invitationId,
  );

  return {
    admin,
    member,
    slug,
    close: () => Promise.all([adminContext.close(), memberContext.close()]),
  };
}

/** Creates a project through the dialog on the projects page. */
export async function createProject(
  page: Page,
  slug: string,
  name: string,
  key: string,
) {
  await page.goto(`/${slug}/projects`);
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Key", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/projects/${key}/board$`));
}

/** A real pointer drag: hold past the sensor's delay, move in steps, release. */
export async function drag(page: Page, source: Locator, target: Locator) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Nothing to drag");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 12, {
    steps: 4,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 20 });
  await page.mouse.up();
}
