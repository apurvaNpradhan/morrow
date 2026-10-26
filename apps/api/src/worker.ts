import "./platform/instrument";

import { configureEmail } from "@morrow/email";
import { config } from "./platform/config";
import { startJobs, stopJobs } from "./platform/jobs";
import { flushLogs, log, logFailure } from "./platform/logger";

/**
 * The `worker` process: every queue's worker, the schedules and the page job.
 * It serves no HTTP and does not migrate; the `api` process owns the schema.
 */
configureEmail(() => config.email);

try {
  await startJobs();
} catch (error) {
  log.error({ action: "worker.startup", error });
  await flushLogs();
  process.exit(1);
}
log.info("worker", "Running jobs");

let shuttingDown = false;
const gracefulShutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("worker", "Shutting down");
  await stopJobs(10_000).catch((error) =>
    logFailure("jobs.shutdown", {}, error),
  );
  await flushLogs();
  process.exit(0);
};
process.on("SIGTERM", () => void gracefulShutdown());
process.on("SIGINT", () => void gracefulShutdown());
