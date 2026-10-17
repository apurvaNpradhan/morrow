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
  const field = dialog.getByLabel("Title", { exact: true });
  await field.fill(title);
  await dialog
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/created$/).first()).toBeVisible();
}

test("a comment posted in one tab appears in another's open sheet and on the card, and edits and deletes follow", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Comment");
  await createProject(admin, slug, "Comment project", "CMT");
  await admin.goto(`/${slug}/projects/CMT/board`);
  await createTask(admin, "To Do", "Discuss me");

  await admin.goto(`/${slug}/tasks/CMT-1`);
  await member.goto(`/${slug}/tasks/CMT-1`);
  const adminSheet = sheetOf(admin);
  const memberSheet = sheetOf(member);
  await expect(adminSheet.getByLabel("Title", { exact: true })).toHaveValue(
    "Discuss me",
  );

  // Post: it shows in both sheets and the card behind them gains a badge.
  await adminSheet
    .getByRole("textbox", { name: "Write a comment", exact: true })
    .click();
  await admin.keyboard.type("First **thoughts**");
  await adminSheet
    .getByRole("button", { name: "Comment", exact: true })
    .click();
  await expect(adminSheet.getByText("thoughts")).toBeVisible();
  await expect(memberSheet.getByText("thoughts")).toBeVisible();
  await expect(
    memberSheet
      .locator("[data-comment-id]")
      .getByText("Comment Admin", { exact: true }),
  ).toBeVisible();
  await expect(
    member.locator("[data-task-id]").getByTitle("1 comment"),
  ).toBeVisible();

  // A Member answers; the author of each is shown.
  await memberSheet
    .getByRole("textbox", { name: "Write a comment", exact: true })
    .click();
  await member.keyboard.type("Agreed");
  await member.keyboard.press("ControlOrMeta+Enter");
  await expect(adminSheet.getByText("Agreed")).toBeVisible();
  await expect(
    admin.locator("[data-task-id]").getByTitle("2 comments"),
  ).toBeVisible();

  // Edit: the other tab sees the new text, marked edited.
  const mine = adminSheet.locator("[data-comment-id]").first();
  await mine.getByRole("button", { name: "Comment actions" }).click();
  await admin.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const editor = mine.getByRole("textbox", { name: "Edit comment" });
  await editor.click();
  await admin.keyboard.press("ControlOrMeta+A");
  await admin.keyboard.type("Revised thoughts");
  await mine.getByRole("button", { name: "Save", exact: true }).click();
  await expect(memberSheet.getByText("Revised thoughts")).toBeVisible();
  await expect(memberSheet.getByText("edited", { exact: true })).toBeVisible();

  // A Member cannot edit or delete another's comment; the author deletes theirs.
  const theirs = memberSheet.locator("[data-comment-id]").first();
  await expect(
    theirs.getByRole("button", { name: "Comment actions" }),
  ).toHaveCount(0);
  await mine.getByRole("button", { name: "Comment actions" }).click();
  await admin.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(memberSheet.getByText("Revised thoughts")).toHaveCount(0);
  await expect(
    member.locator("[data-task-id]").getByTitle("1 comment"),
  ).toBeVisible();
  await close();
});
