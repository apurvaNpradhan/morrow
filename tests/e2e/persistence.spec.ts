import { expect, type BrowserContext, type Page, test } from "@playwright/test";
import {
  createProject,
  createWorkspace,
  signUp,
  twoPeople,
  uniqueEmail,
} from "./helpers";

const OWNER_STAMP_KEY = "morrow:owner-stamp";

/**
 * Holds every shape request and the session request until `release()`, so
 * whatever renders in the meantime came from the browser's local database.
 */
async function stallNetwork(page: Page) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/(shapes\/|auth\/get-session)/, async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  return release;
}

/** Waits until the first sync is done and the browser's database is the user's. */
async function waitForStamp(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) => localStorage.getItem(key) !== null,
        OWNER_STAMP_KEY,
      ),
    )
    .toBe(true);
}

async function createTask(page: Page, title: string) {
  await page.keyboard.press("c");
  const dialog = page.locator('[data-slot="dialog-popup"]');
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Title", { exact: true }).press("Enter");
  await expect(page.getByText(/created$/).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

const card = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`: ${title}$`) });

/** A user with a Workspace, a Project and one Task, whose database is warm. */
async function warmUser(page: Page, label: string) {
  await signUp(page, uniqueEmail(label), `${label} Person`);
  const slug = await createWorkspace(page, `${label} Space`);
  await createProject(page, slug, `${label} project`, "PRS");
  await createTask(page, `${label} task`);
  await waitForStamp(page);
  // A reload with the network open lets the Task subset reach the database.
  await page.reload();
  await expect(card(page, `${label} task`)).toBeVisible();
  return slug;
}

test("a reload renders the workspace, projects and board from the local database", async ({
  page,
}) => {
  const slug = await warmUser(page, "Reload");
  const release = await stallNetwork(page);

  await page.reload();
  await expect(card(page, "Reload task")).toBeVisible();
  await expect(page.getByText("Reload Space").first()).toBeVisible();
  await page.goto(`/${slug}/projects`);
  await expect(page.getByText("Reload project").first()).toBeVisible();
  release();
});

test("a change made while the network was stalled appears once it is lifted", async ({
  browser,
}) => {
  const { admin, member, slug, close } = await twoPeople(browser, "Catchup");
  await createProject(admin, slug, "Catchup project", "CAT");
  await createTask(admin, "Before");
  await member.goto(`/${slug}/projects/CAT/board`);
  await expect(card(member, "Before")).toBeVisible();
  await waitForStamp(member);

  const release = await stallNetwork(member);
  await member.reload();
  await expect(card(member, "Before")).toBeVisible();
  await createTask(admin, "While stalled");
  await expect(card(member, "While stalled")).toHaveCount(0);

  release();
  await expect(card(member, "While stalled")).toBeVisible();
  await close();
});

test("the previous user's rows never render for the next user, even with shapes stalled", async ({
  page,
}) => {
  const slug = await warmUser(page, "First");
  await page.goto(`/${slug}`);
  await page.getByRole("button", { name: "FP" }).first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in/);

  const release = await stallNetwork(page);
  await signUp(page, uniqueEmail("second"), "Second Person");
  await page.goto(`/${slug}/projects`);
  await expect(page.getByText("First project")).toHaveCount(0);
  await expect(page.getByText("First Space")).toHaveCount(0);
  release();
});

test("a session that is gone shows the cached workspace, then leaves for sign-in and keeps nothing", async ({
  page,
  context,
}) => {
  const slug = await warmUser(page, "Gone");
  await context.clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/auth\/sign-in/);

  const release = await stallNetwork(page);
  await page.goto(`/${slug}`);
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByText("Gone Space")).toHaveCount(0);
  release();
});

test("two tabs share the database, follow live changes and do not fight over locks", async ({
  context,
  page,
}) => {
  const errors: string[] = [];
  context.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const slug = await warmUser(page, "Tabs");
  const second = await context.newPage();
  await second.goto(`/${slug}/projects/PRS/board`);
  await expect(card(second, "Tabs task")).toBeVisible();

  await createTask(page, "Seen in both");
  await expect(card(second, "Seen in both")).toBeVisible();
  expect(errors.filter((text) => /lock|opfs/i.test(text))).toEqual([]);
});

test("signing out in one tab sends the other to sign-in", async ({
  context,
  page,
}) => {
  const slug = await warmUser(page, "Out");
  const second = await context.newPage();
  await second.goto(`/${slug}/projects/PRS/board`);
  await expect(card(second, "Out task")).toBeVisible();

  await page.goto(`/${slug}`);
  await page.getByRole("button", { name: "OP" }).first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(second).toHaveURL(/\/auth\/sign-in/);
});

test("without OPFS the app loads and syncs from the network", async ({
  browser,
}) => {
  const context: BrowserContext = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator.storage, "getDirectory", {
      value: () => Promise.reject(new Error("no OPFS")),
    });
  });
  const page = await context.newPage();
  await signUp(page, uniqueEmail("nopfs"), "Plain Person");
  const slug = await createWorkspace(page, "Plain Space");
  await createProject(page, slug, "Plain project", "PLN");
  await page.goto(`/${slug}/projects`);
  await expect(page.getByText("Plain project").first()).toBeVisible();
  await context.close();
});
