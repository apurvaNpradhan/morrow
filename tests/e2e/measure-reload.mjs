// Reload timing on the demo Workspace, by hand (not a CI gate):
//
//   pnpm --dir tests/e2e exec playwright codegen --save-storage=/tmp/morrow-state.json https://localhost:18173
//   node tests/e2e/measure-reload.mjs /tmp/morrow-state.json /demo-scale/projects/PLAT/board
//
// The stack needs `pnpm --filter @morrow/api seed:demo <owner-email>` (405k
// Tasks). The first load warms the browser's database; the next ones are
// reloads. Prints the median of RUNS reloads, with no throttling and with a
// "Fast 4G" profile, of: time to the first Task card on the board, and time to
// the last Task shape response that says "up to date".
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const COLD = args.includes("--cold");
const [statePath, path = "/demo-scale/projects/PLAT/board"] = args.filter(
  (arg) => arg !== "--cold",
);
if (!statePath) {
  console.error("usage: measure-reload.mjs <storage-state.json> [board path]");
  process.exit(1);
}
const BASE_URL = process.env.BASE_URL ?? "https://localhost:18173";
const RUNS = Number(process.env.RUNS ?? 5);
const FAST_4G = {
  offline: false,
  downloadThroughput: (9 * 1024 * 1024) / 8,
  uploadThroughput: (1.5 * 1024 * 1024) / 8,
  latency: 170,
};

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function reloadOnce(page) {
  let upToDateAt;
  const started = performance.now();
  page.on("response", (response) => {
    if (
      response.url().includes("/shapes/tasks") &&
      response.headers()["electric-up-to-date"] !== undefined
    ) {
      upToDateAt = performance.now() - started;
    }
  });
  await page.reload();
  await page.locator('[data-lane] [role="button"]').first().waitFor();
  const firstPaint = performance.now() - started;
  await page.waitForLoadState("networkidle").catch(() => {});
  return { firstPaint, upToDate: upToDateAt ?? Number.NaN };
}

async function coldOnce(browser, profile) {
  const context = await browser.newContext({
    storageState: statePath,
    ignoreHTTPSErrors: true,
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  if (profile) {
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", profile);
  }
  let jsBytes = 0;
  page.on("response", async (response) => {
    if (!response.url().endsWith(".js")) return;
    const length = Number(response.headers()["content-length"]);
    jsBytes += Number.isFinite(length) ? length : 0;
  });
  const started = performance.now();
  await page.goto(path, { waitUntil: "commit" });
  await page.locator('[data-lane] [role="button"]').first().waitFor({
    timeout: 300_000,
  });
  const firstPaint = performance.now() - started;
  const fcp = await page.evaluate(
    () =>
      performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint")?.startTime ??
      Number.NaN,
  );
  await page.waitForLoadState("networkidle").catch(() => {});
  await context.close();
  return { firstPaint, fcp, jsBytes };
}

async function measureCold(profile) {
  const browser = await chromium.launch();
  const results = [];
  for (let run = 0; run < RUNS; run++) {
    results.push(await coldOnce(browser, profile));
  }
  await browser.close();
  return {
    fcpMs: Math.round(median(results.map((r) => r.fcp))),
    firstTaskCardMs: Math.round(median(results.map((r) => r.firstPaint))),
    jsKbTransferred: Math.round(median(results.map((r) => r.jsBytes)) / 1024),
  };
}

async function measure(profile) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: statePath,
    ignoreHTTPSErrors: true,
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(path);
  await page
    .locator('[data-lane] [role="button"]')
    .first()
    .waitFor({ timeout: 120_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  if (profile) {
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", profile);
  }
  const results = [];
  for (let run = 0; run < RUNS; run++) results.push(await reloadOnce(page));
  await browser.close();
  return {
    firstPaintMs: Math.round(median(results.map((r) => r.firstPaint))),
    upToDateMs: Math.round(median(results.map((r) => r.upToDate))),
  };
}

const run = COLD ? measureCold : measure;
console.log("no throttling:", await run(undefined));
console.log("Fast 4G:      ", await run(FAST_4G));
