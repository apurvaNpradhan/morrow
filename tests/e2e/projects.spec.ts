import { expect, type Browser, type Page, test } from "@playwright/test";
import {
  createWorkspace,
  invite,
  joinWorkspace,
  signUp,
  uniqueEmail,
} from "./helpers";

/** An admin who owns a workspace and a second member, each in their own browser. */
async function twoPeople(browser: Browser, label: string) {
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();

  // Addresses are lower-cased by the server, so its log (which the helpers read) is too.
  const prefix = label.toLowerCase();
  const memberEmail = uniqueEmail(`${prefix}-member`);
  await signUp(admin, uniqueEmail(`${prefix}-admin`), `${label} Admin`);
  const slug = await createWorkspace(admin, `${label} Space`);
  const invitationId = await invite(admin, slug, memberEmail);
  await joinWorkspace(
    member,
    memberEmail,
    `${label} Member`,
    slug,
    invitationId,
  );

  return {
    admin,
    member,
    slug,
    close: () => Promise.all([adminContext.close(), memberContext.close()]),
  };
}

/** Creates a project through the dialog on the projects page. */
async function createProject(
  page: Page,
  slug: string,
  name: string,
  key: string,
) {
  await page.goto(`/${slug}/projects`);
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Key", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/projects/${key}$`));
}

/** The workflow section of one category on the project's workflow settings page. */
const group = (page: Page, title: string) =>
  page.locator("section", {
    has: page.getByRole("heading", { name: title, exact: true }),
  });

test("a new project appears for another member without a reload", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Create");
  await member.goto(`/${slug}/projects`);
  await expect(member.getByText("No projects yet").first()).toBeVisible();

  await createProject(admin, slug, "Website redesign", "WEB");

  await expect(
    member.getByRole("link", { name: "Website redesign" }).first(),
  ).toBeVisible();
  // The board opens with the default workflow, in order.
  await member.getByRole("link", { name: "Website redesign" }).first().click();
  const lanes = member.getByRole("list", {
    name: /Columns of Website redesign/,
  });
  await expect(lanes.getByRole("heading")).toHaveText([
    "Backlog",
    "To Do",
    "In Progress",
    "Done",
    "Canceled",
  ]);

  await close();
});

test("reordering projects reaches another member's list", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Order");
  await createProject(admin, slug, "Alpha", "ALP");
  await createProject(admin, slug, "Beta", "BET");
  await member.goto(`/${slug}/projects`);
  const names = () =>
    member
      .locator("main ul > li")
      .evaluateAll((rows) =>
        rows.map(
          (row) => row.querySelector('[data-slot="project-name"]')?.textContent,
        ),
      );
  await expect.poll(names).toEqual(["Alpha", "Beta"]);

  await admin.goto(`/${slug}/projects`);
  const handle = admin.getByRole("button", { name: /^Reorder Beta/ });
  await handle.focus();
  await handle.press("ArrowUp");

  await expect.poll(names).toEqual(["Beta", "Alpha"]);
  await close();
});

test("column changes in the workflow settings reach the board", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Flow");
  await createProject(admin, slug, "Flow project", "FLW");
  await member.goto(`/${slug}/projects/FLW`);
  const headings = member
    .getByRole("list", { name: /Columns of Flow project/ })
    .getByRole("heading");
  await expect(headings).toHaveCount(5);

  await admin.goto(`/${slug}/settings/projects/FLW/workflow`);
  const started = group(admin, "In progress");
  await started.getByLabel("Add a column").fill("In Review");
  await started.getByRole("button", { name: "Add column" }).click();
  await expect(headings).toHaveText([
    "Backlog",
    "To Do",
    "In Progress",
    "In Review",
    "Done",
    "Canceled",
  ]);

  const name = started.getByLabel("Name of the column").nth(1);
  await name.fill("Review");
  await name.blur();
  await expect(headings.nth(3)).toHaveText("Review");

  await close();
});

test("archiving a project moves it out of everyone's sidebar", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Archive");
  await createProject(admin, slug, "Old plan", "OLD");
  await member.goto(`/${slug}/projects`);
  const sidebarLink = member.getByRole("link", { name: "Old plan" }).first();
  await expect(sidebarLink).toBeVisible();

  await admin.goto(`/${slug}/settings/projects/OLD/general`);
  await admin.getByRole("button", { name: "Archive", exact: true }).click();

  await expect(member.getByRole("link", { name: "Old plan" })).toHaveCount(0);
  await member.getByRole("tab", { name: /Archived/ }).click();
  // The row link, not the "Settings for Old plan" shortcut next to it.
  await expect(member.getByRole("link", { name: /^Old plan/ })).toBeVisible();
  // The settings are read-only until it is restored.
  await expect(admin.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(admin.getByRole("button", { name: "Unarchive" })).toBeVisible();

  await close();
});

test("changing a key moves the project and leaves the old URL empty", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("key"), "Key Tester");
  const slug = await createWorkspace(page, "Key Space");
  await createProject(page, slug, "Rekey me", "OLD");

  await page.goto(`/${slug}/settings/projects/OLD/general`);
  const key = page.getByLabel("Key", { exact: true });
  await key.fill("NEW");
  await key.blur();
  await page.getByRole("button", { name: "Change key" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/${slug}/settings/projects/NEW/general`),
  );

  await page.goto(`/${slug}/projects/OLD`);
  await expect(
    page.getByText("It may have been deleted, or its key may have changed."),
  ).toBeVisible();
  await page.goto(`/${slug}/projects/NEW`);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
});
