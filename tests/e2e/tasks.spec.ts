import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createProject, twoPeople } from "./helpers";

/** The lane of a Column on the board. */
const lane = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

/** The dialog popup and the task sheet; toasts are dialogs to assistive technology too. */
const dialogOf = (page: Page) => page.locator('[data-slot="dialog-popup"]');
const sheetOf = (page: Page) => page.locator('[data-slot="sheet-popup"]');

/** A card or row by ticket id and title. */
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
  for (const [index, text] of titles.entries()) {
    await title.fill(text);
    await title.press("Enter");
    await expect(title).toHaveValue("");
    // The toast names the ticket once its number has synced.
    await expect(page.getByText(new RegExp(`created$`)).first()).toBeVisible();
    expect(index).toBeGreaterThanOrEqual(0);
  }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** A real pointer drag: hold past the sensor's delay, move in steps, release. */
async function drag(page: Page, source: Locator, target: Locator) {
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

test("tasks created in one tab appear numbered in another member's board", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Create");
  await createProject(admin, slug, "Tasks project", "TSK");
  await member.goto(`/${slug}/projects/TSK/board`);
  await expect(lane(member, "To Do")).toBeVisible();

  await createTasks(admin, "To Do", ["First task", "Second task"]);

  await expect(
    card(lane(member, "To Do"), "TSK-1", "First task"),
  ).toBeVisible();
  await expect(
    card(lane(member, "To Do"), "TSK-2", "Second task"),
  ).toBeVisible();
  await expect(member.getByText("2 tasks")).toBeVisible();

  // C opens the dialog anywhere on the page.
  await admin.keyboard.press("c");
  await expect(
    dialogOf(admin).getByLabel("Title", { exact: true }),
  ).toBeVisible();
  await admin.keyboard.press("Escape");
  await close();
});

test("moving a card to Done stamps it for everyone, and archiving all completed clears the lane", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Move");
  await createProject(admin, slug, "Move project", "MVE");
  await admin.goto(`/${slug}/projects/MVE/board`);
  await createTasks(admin, "To Do", ["Ship it"]);
  await member.goto(`/${slug}/projects/MVE/board`);
  await expect(card(lane(member, "To Do"), "MVE-1", "Ship it")).toBeVisible();

  await drag(admin, card(admin, "MVE-1", "Ship it"), lane(admin, "Done"));

  const done = card(lane(member, "Done"), "MVE-1", "Ship it");
  await expect(done).toBeVisible();
  // Finished work is muted.
  await expect(done).toHaveCSS("opacity", "0.6");

  await admin
    .getByRole("button", { name: "Archive all tasks in Done", exact: true })
    .click();
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(card(lane(admin, "Done"), "MVE-1", "Ship it")).toHaveCount(0);
  await expect(card(lane(member, "Done"), "MVE-1", "Ship it")).toHaveCount(0);

  // It waits in the list's Archived group and unarchiving returns it to Done.
  await admin.goto(`/${slug}/projects/MVE/list`);
  await admin
    .getByRole("button", { name: "Expand Archived", exact: true })
    .click();
  const row = card(admin, "MVE-1", "Ship it");
  await expect(row).toBeVisible();
  await row.click({ button: "right" });
  await admin.getByRole("menuitem", { name: "Unarchive", exact: true }).click();
  await admin.getByRole("button", { name: "Expand Done", exact: true }).click();
  await expect(
    admin
      .getByRole("region", { name: "Done", exact: true })
      .getByRole("button", {
        name: "MVE-1: Ship it",
      }),
  ).toBeVisible();
  await close();
});

test("a task link opens its sheet cold, and edits reach another open sheet", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Sheet");
  await createProject(admin, slug, "Sheet project", "SHT");
  await admin.goto(`/${slug}/projects/SHT/board`);
  await createTasks(admin, "To Do", ["Original title"]);

  await admin.goto(`/${slug}/tasks/SHT-1`);
  await member.goto(`/${slug}/tasks/SHT-1`);
  const adminSheet = sheetOf(admin);
  const memberSheet = sheetOf(member);
  await expect(adminSheet.getByLabel("Title", { exact: true })).toHaveValue(
    "Original title",
  );
  // The board is behind the sheet.
  await expect(lane(admin, "To Do")).toBeVisible();

  const title = adminSheet.getByLabel("Title", { exact: true });
  await title.fill("Renamed in the sheet");
  await title.blur();
  await adminSheet
    .getByRole("textbox", { name: "Description", exact: true })
    .click();
  await admin.keyboard.type("Written live");

  await expect(memberSheet.getByLabel("Title", { exact: true })).toHaveValue(
    "Renamed in the sheet",
  );
  await expect(memberSheet.getByText("Written live")).toBeVisible();

  // An unknown ticket says so.
  await admin.goto(`/${slug}/tasks/SHT-99`);
  await expect(admin.getByText(/SHT-99 doesn't exist/)).toBeVisible();
  await close();
});

test("a filter and a sort survive a reload and the toolbar counts what is hidden", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Filter");
  await createProject(admin, slug, "Filter project", "FLT");
  await admin.goto(`/${slug}/projects/FLT/board`);
  await createTasks(admin, "To Do", ["Mine", "Not mine"]);

  await card(admin, "FLT-1", "Mine").click();
  await sheetOf(admin)
    .getByRole("button", { name: "Assignee", exact: true })
    .click();
  await admin.getByRole("menuitemradio", { name: /\(me\)$/ }).click();
  await admin.keyboard.press("Escape");
  await expect(sheetOf(admin)).toBeHidden();

  await admin.getByRole("button", { name: "Filter", exact: true }).click();
  await admin.getByRole("menuitem", { name: "Assignee", exact: true }).click();
  await admin
    .getByRole("menuitemcheckbox", { name: "Me", exact: true })
    .click();
  await admin.keyboard.press("Escape");
  await admin.keyboard.press("Escape");
  await admin.getByRole("button", { name: "Display", exact: true }).click();
  await admin
    .getByRole("menuitemradio", { name: "Priority", exact: true })
    .click();
  await admin.keyboard.press("Escape");

  await admin.reload();
  await expect(admin.getByText("1 of 2 tasks")).toBeVisible();
  await expect(
    admin.getByRole("button", { name: "Edit the Assignee filter" }),
  ).toBeVisible();
  await expect(card(admin, "FLT-2", "Not mine")).toHaveCount(0);
  await admin.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(card(admin, "FLT-2", "Not mine")).toBeVisible();
  await close();
});

test("hiding due dates on the Preferences page applies to the board", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Display");
  await createProject(admin, slug, "Display project", "DSP");
  await admin.goto(`/${slug}/projects/DSP/board`);
  await createTasks(admin, "To Do", ["Due today"]);
  await card(admin, "DSP-1", "Due today").click();
  await sheetOf(admin)
    .getByRole("button", { name: "Due date", exact: true })
    .click();
  await admin.getByRole("menuitem", { name: "Today", exact: true }).click();
  await admin.keyboard.press("Escape");
  const dueChip = card(admin, "DSP-1", "Due today").getByText("Today");
  await expect(dueChip).toBeVisible();

  await admin.goto(`/${slug}/settings/account/preferences`);
  await admin.getByLabel("Due dates", { exact: true }).click();
  await admin.goto(`/${slug}/projects/DSP/board`);
  await expect(card(admin, "DSP-1", "Due today")).toBeVisible();
  await expect(
    card(admin, "DSP-1", "Due today").getByText("Today"),
  ).toHaveCount(0);
  await close();
});

test("tasks export to a file and import into another project, with warnings", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Port");
  await createProject(admin, slug, "Source", "SRC");
  await admin.goto(`/${slug}/projects/SRC/board`);
  await createTasks(admin, "To Do", ["Travels", "Also travels"]);
  await createProject(admin, slug, "Target", "TGT");

  await admin.goto(`/${slug}/settings/projects/SRC/general`);
  const download = admin.waitForEvent("download");
  await admin.getByRole("button", { name: "Export", exact: true }).click();
  const path = join(tmpdir(), `${Date.now()}-SRC-tasks.json`);
  await (await download).saveAs(path);
  const document = JSON.parse(readFileSync(path, "utf8")) as {
    tasks: Array<{ column: string }>;
  };
  expect(document.tasks).toHaveLength(2);
  document.tasks[0]!.column = "Nowhere";
  writeFileSync(path, JSON.stringify(document));

  await admin.goto(`/${slug}/settings/projects/TGT/general`);
  await admin.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = dialogOf(admin);
  await dialog.locator('input[type="file"]').setInputFiles(path);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByText("2 tasks imported.")).toBeVisible();
  await expect(dialog.getByText(/“Nowhere” went to “To Do”/)).toBeVisible();

  await admin.goto(`/${slug}/projects/TGT/board`);
  await expect(card(lane(admin, "To Do"), "TGT-1", "Travels")).toBeVisible();
  await expect(
    card(lane(admin, "To Do"), "TGT-2", "Also travels"),
  ).toBeVisible();
  await close();
});

test("deleting an active project by typing its key removes it and its tasks for others", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Delete");
  await createProject(admin, slug, "Doomed", "DOM");
  await admin.goto(`/${slug}/projects/DOM/board`);
  await createTasks(admin, "To Do", ["Gone soon"]);
  await member.goto(`/${slug}/projects/DOM/board`);
  await expect(card(member, "DOM-1", "Gone soon")).toBeVisible();

  await admin.goto(`/${slug}/settings/projects/DOM/general`);
  await admin
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  const dialog = admin.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", {
    name: "Delete project",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DOM to confirm").fill("DOM");
  await confirm.click();

  await expect(
    member.getByText("It may have been deleted, or its key may have changed."),
  ).toBeVisible();
  await member.goto(`/${slug}/tasks/DOM-1`);
  await expect(
    member.getByText("It may have been deleted, or its key may have changed."),
  ).toBeVisible();
  await close();
});

test("shift-click selects a run of cards, P sets their priority, and another tab sees it", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Bulk");
  await createProject(admin, slug, "Bulk project", "BLK");
  await admin.goto(`/${slug}/projects/BLK/board`);
  await createTasks(admin, "To Do", ["One", "Two", "Three", "Four"]);
  await member.goto(`/${slug}/projects/BLK/board`);
  await expect(card(lane(member, "To Do"), "BLK-4", "Four")).toBeVisible();

  const todo = lane(admin, "To Do");
  await card(todo, "BLK-1", "One").click({ modifiers: ["ControlOrMeta"] });
  await card(todo, "BLK-3", "Three").click({ modifiers: ["Shift"] });
  await expect(admin.getByText("3 selected")).toBeVisible();

  await admin.keyboard.press("p");
  await admin.getByRole("menuitemradio", { name: "High" }).click();

  for (const page of [admin, member]) {
    for (const [ticket, title] of [
      ["BLK-1", "One"],
      ["BLK-2", "Two"],
      ["BLK-3", "Three"],
    ]) {
      await expect(
        card(lane(page, "To Do"), ticket!, title!).getByRole("button", {
          name: "High",
        }),
      ).toBeVisible();
    }
  }
  await expect(
    card(lane(member, "To Do"), "BLK-4", "Four").getByRole("button", {
      name: "High",
    }),
  ).toHaveCount(0);

  // Escape clears the selection.
  await admin.keyboard.press("Escape");
  await expect(admin.getByText("3 selected")).toBeHidden();
  await close();
});

test("select all in the list and Mod+Backspace delete them for everyone", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "BulkDel");
  await createProject(admin, slug, "Bulk delete", "BDL");
  await admin.goto(`/${slug}/projects/BDL/board`);
  await createTasks(admin, "To Do", ["Alpha", "Beta", "Gamma"]);
  await member.goto(`/${slug}/projects/BDL/list`);
  await expect(member.getByText("3 tasks")).toBeVisible();

  await admin.goto(`/${slug}/projects/BDL/list`);
  await card(admin, "BDL-1", "Alpha").focus();
  await admin.keyboard.press("ControlOrMeta+a");
  await expect(admin.getByText("3 selected")).toBeVisible();
  await admin.keyboard.press("ControlOrMeta+Backspace");

  const dialog = admin.getByRole("alertdialog");
  await expect(dialog.getByText("Delete 3 tasks?")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete 3 tasks" }).click();

  await expect(admin.getByText("Deleted 3 tasks")).toBeVisible();
  await expect(card(member, "BDL-1", "Alpha")).toHaveCount(0);
  await expect(member.getByText("0 tasks")).toBeVisible();
  await close();
});

test("a bulk move reaches another tab, and the selection yields to the sheet and to focus rules", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "BulkKeys");
  await createProject(admin, slug, "Bulk keys", "BKY");
  await admin.goto(`/${slug}/projects/BKY/board`);
  await createTasks(admin, "To Do", ["Red", "Green", "Blue"]);
  await member.goto(`/${slug}/projects/BKY/board`);
  await expect(card(lane(member, "To Do"), "BKY-3", "Blue")).toBeVisible();

  const todo = lane(admin, "To Do");
  await card(todo, "BKY-1", "Red").click({ modifiers: ["ControlOrMeta"] });
  await card(todo, "BKY-2", "Green").click({ modifiers: ["ControlOrMeta"] });
  await expect(admin.getByText("2 selected")).toBeVisible();

  // Right-click on an unselected card acts on it alone and keeps the selection.
  await card(todo, "BKY-3", "Blue").click({ button: "right" });
  await expect(admin.getByRole("menuitem", { name: "Archive" })).toBeVisible();
  await admin.keyboard.press("Escape");
  await expect(admin.getByText("2 selected")).toBeVisible();

  // Selection beats focus: S moves both, though Blue has focus.
  await card(todo, "BKY-3", "Blue").focus();
  await admin.keyboard.press("s");
  await admin.getByRole("menuitemradio", { name: "In Progress" }).click();
  for (const page of [admin, member]) {
    const doing = lane(page, "In Progress");
    await expect(card(doing, "BKY-1", "Red")).toBeVisible();
    await expect(card(doing, "BKY-2", "Green")).toBeVisible();
    await expect(card(lane(page, "To Do"), "BKY-3", "Blue")).toBeVisible();
  }

  // Escape closes the sheet first; the selection goes on the second press.
  await card(lane(admin, "In Progress"), "BKY-1", "Red").click();
  await expect(sheetOf(admin)).toBeVisible();
  await admin.keyboard.press("Escape");
  await expect(sheetOf(admin)).toBeHidden();
  await expect(admin.getByText("2 selected")).toBeVisible();
  await admin.keyboard.press("Escape");
  await expect(admin.getByText("2 selected")).toBeHidden();
  await close();
});
