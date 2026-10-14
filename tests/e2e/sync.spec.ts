import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  invite,
  joinWorkspace,
  signUp,
  uniqueEmail,
} from "./helpers";

test("a role change shows up for the other member without a reload", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();

  const adminEmail = uniqueEmail("sync-admin");
  const memberEmail = uniqueEmail("sync-member");

  await signUp(admin, adminEmail, "Sync Admin");
  const slug = await createWorkspace(admin, "Sync Space");
  const invitationId = await invite(admin, slug, memberEmail);
  await joinWorkspace(member, memberEmail, "Sync Member", slug, invitationId);

  // The member starts with a plain role and cannot invite.
  await expect(
    member
      .getByRole("row", { name: /Sync Member/ })
      .getByText("Member", { exact: true }),
  ).toBeVisible();
  await expect(
    member.getByRole("button", { name: "Invite member" }),
  ).toHaveCount(0);

  // The admin sees the member too, and promotes them.
  await admin.goto(`/${slug}/members`);
  const memberRow = admin.getByRole("row", { name: /Sync Member/ });
  await memberRow.getByRole("combobox").click();
  await admin.getByRole("option", { name: "Admin" }).click();
  await expect(memberRow.getByRole("combobox")).toContainText("Admin");

  // The member's open page changes on its own, and so do the actions it offers.
  await expect(
    member
      .getByRole("row", { name: /Sync Member/ })
      .getByText("Admin", { exact: true }),
  ).toBeVisible();
  await expect(
    member.getByRole("button", { name: "Invite member" }),
  ).toBeVisible();

  await adminContext.close();
  await memberContext.close();
});

test("a theme change applies in the user's other tab", async ({ context }) => {
  const first = await context.newPage();
  await signUp(first, uniqueEmail("sync-theme"), "Theme Tester");
  const slug = await createWorkspace(first, "Theme Space");

  const preferences = `/${slug}/settings/account/preferences`;
  await first.goto(preferences);
  const second = await context.newPage();
  await second.goto(preferences);

  await first.getByRole("radio", { name: /Light/ }).click();
  await expect(first.locator("html")).toHaveClass(/light/);
  await expect(second.locator("html")).toHaveClass(/light/);

  await first.getByRole("radio", { name: /Dark/ }).click();
  await expect(second.locator("html")).toHaveClass(/dark/);
});

test("the previous user's members never show up after signing out and in as someone else", async ({
  page,
}) => {
  const firstEmail = uniqueEmail("sync-first");
  await signUp(page, firstEmail, "First Person");
  const slug = await createWorkspace(page, "First Space");
  await page.goto(`/${slug}/members`);
  await expect(page.getByText(firstEmail)).toBeVisible();

  await page.getByRole("button", { name: "FP" }).first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in/);

  const secondEmail = uniqueEmail("sync-second");
  await signUp(page, secondEmail, "Second Person");
  const secondSlug = await createWorkspace(page, "Second Space");
  await page.goto(`/${secondSlug}/members`);

  await expect(page.getByText(secondEmail)).toBeVisible();
  await expect(page.getByText(firstEmail)).toHaveCount(0);
  await expect(page.getByText("First Person")).toHaveCount(0);
});
