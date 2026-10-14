import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { consoleEmailCode } from "./helpers";

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
