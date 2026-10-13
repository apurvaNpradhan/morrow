import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import type { createApp } from "./create-app";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drainSignInEmails, reconcileAdminRoles } from "#api/auth/index";
import { seedDefaultWorkspaceRoles } from "#api/workspace/index";
import { config } from "./config";
import { getDatabase } from "./database";
import { prepareDatabaseStartup } from "./database/prepare-database-startup";
import { waitForDatabase } from "./database/wait-for-database";
import { startJobs, stopJobs } from "./jobs";
import { flushLogs, log, logFailure } from "./logger";

export async function runStartupTasks() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // Next to dist/ in the built image; two levels up from src/platform in dev.
  const migrationsFolder = ["../drizzle", "../../drizzle"]
    .map((relative) => join(currentDir, relative))
    .find((folder) => existsSync(join(folder, "meta", "_journal.json")));
  if (!migrationsFolder) {
    throw new Error("Could not find the drizzle migrations folder.");
  }

  await prepareDatabaseStartup({
    waitForDatabase: async () => {
      await waitForDatabase({
        query: async () => {
          await getDatabase().execute(sql`SELECT 1`);
        },
      });
    },
    runStartupMigrations: async () => {
      log.info("db", "Migrating database");
      await migrate(getDatabase(), {
        migrationsFolder,
      });
      log.info("db", "Database migrated");
    },
  });

  await seedDefaultWorkspaceRoles();
  await reconcileAdminRoles();

  await startJobs();
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
