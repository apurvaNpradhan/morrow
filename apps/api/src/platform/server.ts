import { serve } from "@hono/node-server";
import type { createApp } from "./create-app";
import { drainSignInEmails, reconcileAdminRoles } from "#api/auth/index";
import { startYjsServer, stopYjsServer } from "#api/documents/index";
import { seedDefaultWorkspaceRoles } from "#api/workspace/index";
import { config } from "./config";
import { stopJobs } from "./jobs";
import { flushLogs, log, logFailure } from "./logger";

/** Everything that needs a migrated database and the auth module. */
async function runStartupTasks() {
  await seedDefaultWorkspaceRoles();
  await reconcileAdminRoles();
  await startYjsServer();
}

export async function startServer(
  { app }: ReturnType<typeof createApp>,
  port = 1337,
) {
  try {
    await runStartupTasks();
  } catch (error) {
    log.error({ action: "db.startup", error });
    await flushLogs();
    process.exit(1);
  }

  let shuttingDown = false;

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    () => {
      log.info("api", `Running at ${config.apiUrl}`);
    },
  );

  const gracefulShutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info("api", "Shutting down");
    server.close();
    await stopYjsServer().catch((error) =>
      logFailure("documents.yjs-shutdown", {}, error),
    );
    await stopJobs(10_000).catch((error) =>
      logFailure("jobs.shutdown", {}, error),
    );
    const signInEmailsDrained = await drainSignInEmails();
    if (!signInEmailsDrained) {
      log.warn("api", "Timed out waiting for pending sign-in emails");
    }
    await flushLogs();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void gracefulShutdown();
  });

  process.on("SIGINT", () => {
    void gracefulShutdown();
  });
}
