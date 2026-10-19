import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { startJobs, stopJobs } from "../../apps/api/src/platform/jobs";
import { startBoss } from "../../apps/api/src/platform/jobs/boss";
import { resetTestDatabase } from "./helpers/database";

beforeAll(resetTestDatabase);
afterAll(() => stopJobs());

describe("job schedules", () => {
  it("registers every cron in code and removes schedules that are not", async () => {
    const boss = await startBoss();
    await boss.createQueue("retired-cron");
    await boss.schedule("retired-cron", "0 * * * *");

    await startJobs();

    const names = (await boss.getSchedules()).map((entry) => entry.name);
    expect(names).toContain("draft-upload-cleanup");
    expect(names).not.toContain("retired-cron");
  });
});
