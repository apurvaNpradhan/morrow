import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  invite,
  joinWorkspace,
  signUp,
  uniqueEmail,
} from "./helpers";

test("an invitation reaches the invitee live and turns into a member on accept", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const inviteeContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const invitee = await inviteeContext.newPage();

  const inviteeEmail = uniqueEmail("sync-invitee");
  // The invitee signs up first and waits on the "join or create" step.
  await signUp(invitee, inviteeEmail, "Sync Invitee");
  await expect(invitee).toHaveURL(/\/onboarding\/workspace/);

  await signUp(admin, uniqueEmail("sync-inviter"), "Sync Inviter");
  const slug = await createWorkspace(admin, "Invite Space");
  await invite(admin, slug, inviteeEmail);

  // No reload: the invitation shows up on its own.
  await expect(invitee.getByText("Invite Space")).toBeVisible();
  await invitee.getByRole("button", { name: "Join" }).click();
  await expect(invitee).toHaveURL(new RegExp(`/${slug}`));

  // The admin sees the new member and the pending row goes.
  const row = admin.getByRole("row", { name: new RegExp(inviteeEmail) });
  await expect(row).toBeVisible();
  await expect(row.getByText("pending")).toHaveCount(0);

  await adminContext.close();
  await inviteeContext.close();
});

test("a workspace rename shows for another member without a reload", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();

  const memberEmail = uniqueEmail("sync-rename-member");
  await signUp(admin, uniqueEmail("sync-rename-admin"), "Rename Admin");
  const slug = await createWorkspace(admin, "Old Name");
  const invitationId = await invite(admin, slug, memberEmail);
  await joinWorkspace(member, memberEmail, "Rename Member", slug, invitationId);
  await member.goto(`/${slug}`);
  await expect(member.getByText("Old Name").first()).toBeVisible();

  await admin.goto(`/${slug}/settings/workspace/general`);
  // Typed, not filled: the form saves after a change it sees as valid and dirty.
  const nameField = admin.getByLabel("Workspace name", { exact: true });
  await nameField.click();
  await nameField.press("ControlOrMeta+a");
  await nameField.pressSequentially("New Name");

  await expect(member.getByText("New Name").first()).toBeVisible();

  await adminContext.close();
  await memberContext.close();
});

test("a former workspace URL still opens the renamed workspace", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("sync-slug"), "Slug Tester");
  const slug = await createWorkspace(page, "Slug Space");
  const renamed = `${slug}-new`;

  await page.goto(`/${slug}/settings/workspace/general`);
  await page.getByLabel("URL", { exact: true }).fill(renamed);
  await expect(page.getByText("This URL is available")).toBeVisible();
  await page.getByRole("button", { name: "Change URL" }).click();
  await expect(page).toHaveURL(new RegExp(`/${renamed}/settings`));

  await page.goto(`/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/${renamed}/?$`));
});

test("a member who is removed is taken off the workspace live", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();

  const memberEmail = uniqueEmail("sync-removed");
  await signUp(admin, uniqueEmail("sync-remover"), "Remover");
  const slug = await createWorkspace(admin, "Remove Space");
  const invitationId = await invite(admin, slug, memberEmail);
  await joinWorkspace(
    member,
    memberEmail,
    "Removed Member",
    slug,
    invitationId,
  );
  await member.goto(`/${slug}`);
  await expect(member).toHaveURL(new RegExp(`/${slug}/?$`));

  await admin.goto(`/${slug}/settings/workspace/members`);
  const row = admin.getByRole("row", { name: /Removed Member/ });
  await row.getByRole("button", { name: "Remove member" }).click();
  await admin.getByRole("menuitem", { name: "Remove Member" }).click();
  await admin.getByRole("button", { name: "Remove Member" }).click();

  await expect(member).not.toHaveURL(new RegExp(`/${slug}`));

  await adminContext.close();
  await memberContext.close();
});
