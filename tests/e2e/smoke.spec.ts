import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Without a Resend key the API writes emails to its console. Read the
// disposable stack's log and return the sign-in code from the newest email.
function consoleEmailCode(to: string) {
  const logs = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "tests/e2e/compose.yml",
      "logs",
      "--no-log-prefix",
      "morrow",
    ],
    { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" },
  );
  const start = logs.lastIndexOf(`[morrow-email] to=${to} `);
  if (start === -1) return undefined;
  return logs
    .slice(start)
    .match(/(\d{6}) is your Morrow verification code/)?.[1];
}

test("sign up with an emailed code, onboard, create a workspace, invite a member, see activity", async ({
  page,
}) => {
  const suffix = randomUUID();
  const email = `smoke-${suffix}@example.com`;
  const invitee = `invitee-${suffix}@example.com`;
  const workspaceName = `Smoke ${suffix.slice(0, 8)}`;

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

  // Sign-up no longer asks for a name: onboarding does, then the workspace.
  await expect(page).toHaveURL(/\/onboarding\/you/);
  await page.getByLabel("Your name", { exact: true }).fill("Smoke Tester");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page).toHaveURL(/\/onboarding\/workspace/);
  const slug = `smoke-${suffix.slice(0, 8)}`;
  await page.getByLabel("Workspace name", { exact: true }).fill(workspaceName);
  await page.getByLabel("URL", { exact: true }).fill(slug);
  await expect(page.getByText("This URL is available")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Inviting teammates is optional.
  await expect(page).toHaveURL(/\/onboarding\/invite/);
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/?$`));
  const homeUrl = page.url();

  await page.goto(`${homeUrl.replace(/\/$/, "")}/members`);
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByLabel("Email", { exact: true }).fill(invitee);
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await expect(page.getByText("Invitation created")).toBeVisible();

  await page.goto(homeUrl);
  await expect(page.getByText(workspaceName).first()).toBeVisible();
  await expect(
    page.getByText("A workspace invitation was sent").first(),
  ).toBeVisible();
});
