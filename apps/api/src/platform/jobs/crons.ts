import * as Sentry from "@sentry/node";
import type { PgBoss } from "pg-boss";
import { runLoggedJob } from "#api/platform/logger";
import { cleanupDraftUploads, sweepOrphanedAssets } from "#api/storage/index";

type JobOutcome = { degraded?: boolean } | void;

type Cron = { name: string; cron: string; run: () => Promise<JobOutcome> };

/** The only source of truth for schedules: stored ones missing here are removed on start. */
const crons: Cron[] = [
  {
    name: "draft-upload-cleanup",
    cron: "31 * * * *",
    run: cleanupDraftUploads,
  },
  {
    name: "asset-orphan-sweep",
    cron: "17 3 * * *",
    run: () => sweepOrphanedAssets(),
  },
];

// Cron jobs swallow their operational failures (per-item try/catch) so they
// can keep processing the rest of the batch. Reporting Sentry status purely
// from the thrown-rejection channel would always show "ok" for any partially
// failed run. Inspect the returned outcome instead so handled failures light
// up the monitor without aborting the rest of the work. Unexpected throws are
// captured as exception events and swallowed so one bad tick can't retry-storm
// the queue.
async function runWithCheckIn({ name, run }: Cron): Promise<void> {
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: name,
    status: "in_progress",
  });
  try {
    const degraded = await runLoggedJob(name, async (event) => {
      const outcome = await run();
      const degraded = Boolean(outcome && outcome.degraded);
      event.set({ job: { degraded } });
      return degraded;
    });
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: name,
      status: degraded ? "error" : "ok",
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { area: "cron", job: name } });
    Sentry.captureCheckIn({ checkInId, monitorSlug: name, status: "error" });
  }
}

export async function startCrons(boss: PgBoss): Promise<void> {
  for (const cron of crons) {
    // A tick that is still running must not overlap with the next one.
    await boss.createQueue(cron.name, { policy: "singleton", retryLimit: 0 });
    await boss.work(cron.name, async () => runWithCheckIn(cron));
    await boss.schedule(cron.name, cron.cron);
  }
  const known = new Set(crons.map((cron) => cron.name));
  for (const stored of await boss.getSchedules()) {
    if (!known.has(stored.name)) await boss.unschedule(stored.name, stored.key);
  }
}
