import { PgBoss } from "pg-boss";
import { config } from "#api/platform/config";
import { logFailure } from "#api/platform/logger";

let started: Promise<PgBoss> | undefined;
// After shutdown, a late request must not quietly start a second pg-boss.
let stopped = false;

/**
 * pg-boss gets its own small pool so polling workers can't starve request
 * handling. It owns the `pgboss` schema and migrates it on start.
 */
export function startBoss(): Promise<PgBoss> {
  stopped = false;
  return connect();
}

/** The running pg-boss for enqueueing; starts it on first use, but never after shutdown. */
export function bossForEnqueue(): Promise<PgBoss> {
  if (stopped) return Promise.reject(new Error("Jobs are stopped"));
  return connect();
}

function connect(): Promise<PgBoss> {
  started ??= (async () => {
    const boss = new PgBoss({
      connectionString: config.databaseUrl,
      max: 3,
      schema: "pgboss",
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
