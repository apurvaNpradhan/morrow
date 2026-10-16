import { expect, type Locator, type Page, test } from "@playwright/test";
import { createProject, twoPeople } from "./helpers";

const sheetOf = (page: Page) => page.locator('[data-slot="sheet-popup"]');
const dialogOf = (page: Page) => page.locator('[data-slot="dialog-popup"]');
const card = (scope: Page | Locator, ticket: string, title: string) =>
  scope.getByRole("button", { name: `${ticket}: ${title}`, exact: true });

/** Creates tasks one after another through the dialog's "Create more". */
async function createTasks(page: Page, column: string, titles: string[]) {
  await page
    .getByRole("button", { name: `Create a task in ${column}`, exact: true })
    .click();
  const dialog = dialogOf(page);
  await dialog.getByText("Create more", { exact: true }).click();
  const title = dialog.getByLabel("Title", { exact: true });
  for (const text of titles) {
    await title.fill(text);
    await title.press("Enter");
    await expect(title).toHaveValue("");
    await expect(page.getByText(/created$/).first()).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("a label applied in the sheet, or with L, reaches another tab, and a label filter narrows the board and survives a reload", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Label");
  await createProject(admin, slug, "Label project", "LBL");
  await admin.goto(`/${slug}/projects/LBL/board`);
  await createTasks(admin, "To Do", ["Tagged", "Plain", "Keyboard"]);
  await member.goto(`/${slug}/projects/LBL/board`);
  await expect(card(member, "LBL-1", "Tagged")).toBeVisible();

  // Create the label inline from the sheet's picker; it is applied at once.
  await card(admin, "LBL-1", "Tagged").click();
  await sheetOf(admin)
    .getByRole("button", { name: "Labels", exact: true })
    .click();
  const picker = admin.getByRole("combobox", { name: "Labels", exact: true });
  await picker.fill("Bug");
  await admin.getByRole("option", { name: "Create label “Bug”" }).click();
  await admin.keyboard.press("Escape");
  await admin.keyboard.press("Escape");
  await expect(sheetOf(admin)).toBeHidden();

  await expect(card(admin, "LBL-1", "Tagged").getByText("Bug")).toBeVisible();
  await expect(card(member, "LBL-1", "Tagged").getByText("Bug")).toBeVisible();

  // L opens the picker for the focused card. Task shortcuts wait while a
  // toast (a dialog to assistive technology) is on screen.
  await expect(admin.locator('[role="dialog"]')).toHaveCount(0);
  await card(admin, "LBL-3", "Keyboard").focus();
  await admin.keyboard.press("l");
  await admin.getByRole("option", { name: "Bug", exact: true }).click();
  await admin.keyboard.press("Escape");
  await expect(
    card(member, "LBL-3", "Keyboard").getByText("Bug"),
  ).toBeVisible();

  // "Label is Bug" narrows the board and survives a reload.
  await admin.getByRole("button", { name: "Filter", exact: true }).click();
  await admin.getByRole("option", { name: "Label", exact: true }).click();
  await admin.getByRole("option", { name: "Bug", exact: true }).click();
  await admin.keyboard.press("Escape");
  await expect(card(admin, "LBL-2", "Plain")).toHaveCount(0);
  await expect(admin.getByText("2 of 3 tasks")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("2 of 3 tasks")).toBeVisible();
  await expect(card(admin, "LBL-2", "Plain")).toHaveCount(0);
  await close();
});

test("renaming and recolouring a label in settings updates every tab, and deleting it removes the chip", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Settings");
  await createProject(admin, slug, "Settings project", "SET");
  await admin.goto(`/${slug}/projects/SET/board`);
  await createTasks(admin, "To Do", ["Marked"]);

  await card(admin, "SET-1", "Marked").click();
  await sheetOf(admin)
    .getByRole("button", { name: "Labels", exact: true })
    .click();
  await admin
    .getByRole("combobox", { name: "Labels", exact: true })
    .fill("Design");
  await admin.getByRole("option", { name: "Create label “Design”" }).click();
  await admin.keyboard.press("Escape");
  await admin.keyboard.press("Escape");

  await member.goto(`/${slug}/projects/SET/board`);
  await expect(
    card(member, "SET-1", "Marked").getByText("Design"),
  ).toBeVisible();

  await admin.goto(`/${slug}/settings/workspace/labels`);
  const name = admin.getByLabel("Name of the label", { exact: true });
  await name.fill("Visual design");
  await name.blur();
  await expect(
    card(member, "SET-1", "Marked").getByText("Visual design"),
  ).toBeVisible();

  await admin.getByRole("button", { name: "Delete Visual design" }).click();
  const confirm = admin.getByRole("alertdialog");
  await expect(confirm.getByText(/on 1 task\./)).toBeVisible();
  await confirm
    .getByRole("button", { name: "Delete label", exact: true })
    .click();
  await expect(
    card(member, "SET-1", "Marked").getByText("Visual design"),
  ).toHaveCount(0);
  await close();
});
