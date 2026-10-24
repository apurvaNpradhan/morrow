import { expect, type Page, test } from "@playwright/test";
import { createProject, twoPeople } from "./helpers";

const dialogOf = (page: Page) => page.locator('[data-slot="dialog-popup"]');
const sheetOf = (page: Page) => page.locator('[data-slot="sheet-popup"]');
const card = (page: Page, ticket: string, title: string) =>
  page.getByRole("button", { name: `${ticket}: ${title}`, exact: true });

async function createTask(page: Page, column: string, title: string) {
  await page
    .getByRole("button", { name: `Create a task in ${column}`, exact: true })
    .click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Title", { exact: true }).press("Enter");
  await expect(page.getByText(/created$/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Picks a zone in the Preferences page's time zone box. */
async function pickTimeZone(page: Page, slug: string, zone: string) {
  await page.goto(`/${slug}/settings/account/preferences`);
  const box = page.getByLabel("Time zone", { exact: true });
  await box.fill(zone.replaceAll("_", " "));
  await page
    .getByRole("option", { name: zone.replaceAll("_", " "), exact: true })
    .click();
  await expect(box).toHaveValue(zone.replaceAll("_", " "));
}

test("a due date with a time reads in the zone chosen in preferences", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Zone");
  await createProject(admin, slug, "Zone project", "ZON");
  await admin.goto(`/${slug}/projects/ZON/board`);
  await createTask(admin, "To Do", "Call back");

  await pickTimeZone(admin, slug, "Asia/Kolkata");
  await admin.goto(`/${slug}/projects/ZON/board`);
  await card(admin, "ZON-1", "Call back").click();
  await admin.keyboard.press("Shift+D");
  await admin.getByRole("textbox", { name: "Type a date" }).fill("3pm");
  await admin.keyboard.press("Enter");
  await expect(sheetOf(admin).getByText(/3:00\s?PM/)).toBeVisible();
  await admin.keyboard.press("Escape");

  // The same instant, read from another zone: 15:00 in Kolkata is 09:30 UTC.
  await pickTimeZone(admin, slug, "UTC");
  await admin.goto(`/${slug}/projects/ZON/board`);
  await card(admin, "ZON-1", "Call back").click();
  await expect(sheetOf(admin).getByText(/9:30\s?AM/)).toBeVisible();
  await close();
});

test("a start and a due date with times show as one range on the card", async ({
  browser,
}) => {
  const { admin, slug, close } = await twoPeople(browser, "Range");
  await createProject(admin, slug, "Range project", "RNG");
  await admin.goto(`/${slug}/projects/RNG/board`);
  await createTask(admin, "To Do", "Plan the launch");

  await card(admin, "RNG-1", "Plan the launch").click();
  await admin.keyboard.press("Shift+S");
  await admin
    .getByRole("textbox", { name: "Type a date" })
    .fill("tomorrow 9am");
  await admin.keyboard.press("Enter");
  await admin.keyboard.press("Shift+D");
  await admin
    .getByRole("textbox", { name: "Type a date" })
    .fill("in 3 days 5pm");
  await admin.keyboard.press("Enter");
  await admin.keyboard.press("Escape");

  await expect(
    card(admin, "RNG-1", "Plan the launch").getByText(
      /9:00\s?AM → .*5:00\s?PM/,
    ),
  ).toBeVisible();
  await close();
});
