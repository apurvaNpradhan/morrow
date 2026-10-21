import { expect, type Page, test } from "@playwright/test";
import { createProject, twoPeople } from "./helpers";

const dialogOf = (page: Page) => page.locator('[data-slot="dialog-popup"]');
const sheetOf = (page: Page) => page.locator('[data-slot="sheet-popup"]');

/** Creates a task through the dialog and waits for it to be numbered. */
async function createTask(page: Page, column: string, title: string) {
  await page
    .getByRole("button", { name: `Create a task in ${column}`, exact: true })
    .click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/created$/).first()).toBeVisible();
}

test("changes show as history lines in another tab's open sheet, and quick title edits leave one", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "History");
  await createProject(admin, slug, "History project", "HST");
  await admin.goto(`/${slug}/projects/HST/board`);
  await createTask(admin, "To Do", "Original");

  await admin.goto(`/${slug}/tasks/HST-1`);
  await member.goto(`/${slug}/tasks/HST-1`);
  const adminSheet = sheetOf(admin);
  const memberSheet = sheetOf(member);
  await expect(adminSheet.getByLabel("Title", { exact: true })).toHaveValue(
    "Original",
  );
  const history = memberSheet.getByLabel("Comments");
  await expect(history.getByText("created the task")).toBeVisible();

  // Priority: one more line.
  await adminSheet
    .getByRole("button", { name: "Priority", exact: true })
    .click();
  await admin
    .getByRole("menuitemradio", { name: "Urgent", exact: true })
    .click();
  await expect(
    history.getByText("changed the priority from No priority to Urgent"),
  ).toBeVisible();

  // Status and priority changes always keep their own line.
  await adminSheet.getByRole("button", { name: "Status", exact: true }).click();
  await admin
    .getByRole("menuitemradio", { name: "In Progress", exact: true })
    .click();
  await expect(
    history.getByText("moved this from To Do to In Progress"),
  ).toBeVisible();
  await expect(history.getByText("created the task")).toBeVisible();

  // Quick title edits by one person fold into one line, from the first value.
  const title = adminSheet.getByLabel("Title", { exact: true });
  for (const text of ["Draft", "Draft two", "Final"]) {
    await title.fill(text);
    await title.blur();
    await expect(memberSheet.getByLabel("Title", { exact: true })).toHaveValue(
      text,
    );
  }
  await expect(
    history.getByText("changed the title from “Original” to “Final”"),
  ).toBeVisible();
  await expect(history.getByText(/changed the title/)).toHaveCount(1);
  await close();
});
