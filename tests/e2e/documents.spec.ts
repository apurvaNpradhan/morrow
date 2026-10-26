import { expect, type Page, test } from "@playwright/test";
import { twoPeople } from "./helpers";

const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Page text", exact: true });
const treeItem = (page: Page, name: string | RegExp) =>
  page.getByRole("treeitem", { name });

test("two people type into one page and converge, and the page tree reaches both", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Pages");

  // The admin adds a page from the sidebar and names it.
  await admin.goto(`/${slug}`);
  await admin.getByRole("button", { name: "Add a page to Pages" }).click();
  await expect(admin).toHaveURL(new RegExp(`/${slug}/pages/[a-z0-9]+$`));
  const pageUrl = admin.url();
  await admin.getByLabel("Page title", { exact: true }).fill("Launch plan");
  await admin.getByLabel("Page title", { exact: true }).press("Enter");
  await expect(treeItem(admin, /Launch plan/)).toBeVisible();

  // The page is in the member's tree without a reload, and opens.
  await member.goto(`/${slug}`);
  await expect(treeItem(member, /Launch plan/)).toBeVisible();
  await member.goto(pageUrl);

  // Both type into the same paragraph and see each other's text.
  await expect(editorOf(admin)).toBeEditable();
  await expect(editorOf(member)).toBeEditable();
  await editorOf(admin).click();
  await admin.keyboard.type("Hello from the admin.");
  await expect(editorOf(member)).toContainText("Hello from the admin.");

  await editorOf(member).click();
  await member.keyboard.press("Control+End");
  await member.keyboard.type(" And the member.");
  await expect(editorOf(admin)).toContainText(
    "Hello from the admin. And the member.",
  );

  // The text is kept: a reload shows it from the server.
  await admin.reload();
  await expect(editorOf(admin)).toContainText(
    "Hello from the admin. And the member.",
  );

  await close();
});

test("a subpage can be added from the menu and archiving it can be undone", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Subpages");

  await admin.goto(`/${slug}`);
  await admin.getByRole("button", { name: "Add a page to Pages" }).click();
  await expect(admin).toHaveURL(new RegExp(`/${slug}/pages/[a-z0-9]+$`));
  await admin.getByLabel("Page title", { exact: true }).fill("Parent");
  await admin.getByLabel("Page title", { exact: true }).press("Enter");

  await admin
    .getByRole("button", { name: "Actions for Parent", exact: true })
    .click();
  await admin.getByRole("menuitem", { name: "Add a subpage" }).click();
  await expect(admin).toHaveURL(new RegExp(`/${slug}/pages/[a-z0-9]+$`));
  await admin.getByLabel("Page title", { exact: true }).fill("Child");
  await admin.getByLabel("Page title", { exact: true }).press("Enter");
  await expect(treeItem(admin, /Child/)).toBeVisible();

  // Archiving the parent hides the subtree; Undo brings it back.
  await admin
    .getByRole("button", { name: "Actions for Parent", exact: true })
    .click();
  await admin.getByRole("menuitem", { name: "Archive" }).click();
  await expect(treeItem(admin, /Parent/)).toBeHidden();
  await admin.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(treeItem(admin, /Parent/)).toBeVisible();

  await close();
});
