import { PgBoss } from "pg-boss";
import { config } from "#api/platform/config";
import { logFailure } from "#api/platform/logger";

let started: Promise<PgBoss> | undefined;
// After shutdown, a late request must not quietly start a second pg-boss.
let stopped = false;

/**
 * The pg-boss of the `worker` process, which runs the queues' workers, the
 * maintenance and the schedules. It gets its own small pool so polling workers
 * can't starve request handling, owns the `pgboss` schema and migrates it on
 * start.
 */
export function startBoss(): Promise<PgBoss> {
  stopped = false;
  return connect({ works: true });
}

/**
 * The running pg-boss for enqueueing; starts it on first use, but never after
 * shutdown. In the `api` process it only sends: no workers, no maintenance, no
 * schedules.
 */
export function bossForEnqueue(): Promise<PgBoss> {
  if (stopped) return Promise.reject(new Error("Jobs are stopped"));
  return connect({ works: false });
}

function connect({ works }: { works: boolean }): Promise<PgBoss> {
  started ??= (async () => {
    const boss = new PgBoss({
      connectionString: config.databaseUrl,
      max: 3,
      schema: "pgboss",
      supervise: works,
      schedule: works,
    });
    boss.on("error", (error) => logFailure("jobs.boss", {}, error));
    await boss.start();
    return boss;
  })();
  started.catch(() => {
    started = undefined;
  });
  return started;
}

/** Stops workers gracefully and closes the pg-boss pool. */
export async function stopBoss(timeoutMs = 10_000): Promise<void> {
  stopped = true;
  if (!started) return;
  const pending = started;
  started = undefined;
  const boss = await pending.catch(() => undefined);
  await boss?.stop({ graceful: true, timeout: timeoutMs, close: true });
}
