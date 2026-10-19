import { expect, type Page, test } from "@playwright/test";
import { createProject, twoPeople } from "./helpers";

const dialogOf = (page: Page) => page.locator('[data-slot="dialog-popup"]');
const sheetOf = (page: Page) => page.locator('[data-slot="sheet-popup"]');

/** Creates a task through the dialog and closes it. */
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

/** Moves the open task to a Column from the sheet's status chip. */
async function setStatus(page: Page, column: string) {
  await sheetOf(page)
    .getByRole("button", { name: "Status", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: column, exact: true }).click();
}

test("subtasks: add inline, progress with Done collapsed, set and clear a parent, and the picker leaves out invalid choices", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Subtask");
  await createProject(admin, slug, "Plan", "PLN");
  await admin.goto(`/${slug}/projects/PLN/board`);
  await createTask(admin, "To Do", "Epic");
  await member.goto(`/${slug}/projects/PLN/list`);

  // Add a subtask by typing its title; it starts in To Do and the parent counts it.
  await admin.goto(`/${slug}/tasks/PLN-1`);
  const sheet = sheetOf(admin);
  await sheet.getByLabel("Add a sub-task", { exact: true }).fill("Write tests");
  await sheet.getByLabel("Add a sub-task", { exact: true }).press("Enter");
  const subtasks = sheet.getByRole("region", { name: "Sub-tasks" });
  await expect(subtasks.getByText("Write tests")).toBeVisible();
  await expect(subtasks.getByText("PLN-2")).toBeVisible();
  await expect(member.getByTitle("Subtasks done")).toHaveText("0/1");

  // Closing it updates the count while the list's Done group stays collapsed.
  await subtasks.getByRole("button", { name: /PLN-2/ }).click();
  await expect(
    sheet.getByRole("button", { name: "Open the parent PLN-1" }),
  ).toBeVisible();
  await setStatus(admin, "Done");
  await expect(member.getByTitle("Subtasks done")).toHaveText("1/1");
  await expect(
    member.getByRole("button", { name: "PLN-2: Write tests", exact: true }),
  ).toHaveCount(0);

  // Clear the parent, then set it again through the picker.
  await sheet.getByRole("button", { name: "Parent", exact: true }).click();
  await admin.getByRole("button", { name: "Remove parent" }).click();
  await expect(
    sheet.getByRole("button", { name: "Open the parent PLN-1" }),
  ).toHaveCount(0);
  await expect(member.getByTitle("Subtasks done")).toHaveCount(0);

  await sheet.getByRole("button", { name: "Parent", exact: true }).click();
  const picker = admin.getByRole("combobox", { name: "Parent", exact: true });
  await picker.fill("PLN-2");
  await expect(admin.getByRole("option")).toHaveCount(0); // itself
  await picker.fill("PLN-1");
  await admin.getByRole("option", { name: /PLN-1 Epic/ }).click();
  await expect(
    sheet.getByRole("button", { name: "Open the parent PLN-1" }),
  ).toBeVisible();
  await expect(member.getByTitle("Subtasks done")).toHaveText("1/1");

  // The parent cannot be put under its own subtask.
  await sheet.getByRole("button", { name: "Open the parent PLN-1" }).click();
  await sheet.getByRole("button", { name: "Parent", exact: true }).click();
  await admin
    .getByRole("combobox", { name: "Parent", exact: true })
    .fill("PLN-2");
  await expect(admin.getByRole("option")).toHaveCount(0);
  await close();
});

test("relations: a blocks link across Projects shows the blocked mark on the board and clears when the blocker closes", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Relation");
  await createProject(admin, slug, "Plan", "PLN");
  await createProject(admin, slug, "Other", "OTH");
  await admin.goto(`/${slug}/projects/PLN/board`);
  await createTask(admin, "To Do", "Waiting");
  await admin.goto(`/${slug}/projects/OTH/board`);
  await createTask(admin, "To Do", "Blocker");
  await member.goto(`/${slug}/projects/PLN/board`);
  await expect(
    member.getByRole("button", { name: "PLN-1: Waiting", exact: true }),
  ).toBeVisible();

  // OTH-1 blocks PLN-1; the picker leaves out the task itself.
  await admin.goto(`/${slug}/tasks/OTH-1`);
  const sheet = sheetOf(admin);
  await sheet.getByRole("button", { name: "Add relation" }).click();
  await admin.getByRole("menuitem", { name: "Blocks", exact: true }).click();
  const picker = admin.getByRole("combobox", { name: "Blocks", exact: true });
  await picker.fill("OTH-1");
  await expect(admin.getByRole("option")).toHaveCount(0);
  await picker.fill("PLN-1");
  await admin.getByRole("option", { name: /PLN-1 Waiting/ }).click();

  const group = sheet.getByRole("group", { name: "Blocks", exact: true });
  await expect(group.getByText("Waiting")).toBeVisible();
  await expect(member.getByTitle("Blocked by 1 open task")).toBeVisible();

  // It is not offered again for that type, but is for another.
  await sheet.getByRole("button", { name: "Add relation" }).click();
  await admin.getByRole("menuitem", { name: "Blocks", exact: true }).click();
  await admin
    .getByRole("combobox", { name: "Blocks", exact: true })
    .fill("PLN-1");
  await expect(admin.getByRole("option")).toHaveCount(0);
  await admin.keyboard.press("Escape");

  // Closing the blocker clears the mark on the other Project's board.
  await setStatus(admin, "Done");
  await expect(member.getByTitle("Blocked by 1 open task")).toHaveCount(0);

  // Reopening brings it back; removing the relation clears it for good.
  await setStatus(admin, "To Do");
  await expect(member.getByTitle("Blocked by 1 open task")).toBeVisible();
  await sheet
    .getByRole("button", { name: "Remove the relation with PLN-1" })
    .click();
  await expect(group).toHaveCount(0);
  await expect(member.getByTitle("Blocked by 1 open task")).toHaveCount(0);
  await close();
});
