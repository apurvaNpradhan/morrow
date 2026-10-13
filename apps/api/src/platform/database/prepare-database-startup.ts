import { config } from "#api/platform/config";
import { log } from "#api/platform/logger";

type PrepareDatabaseStartupOptions = {
  databaseUrl?: string;
  waitForDatabase: () => Promise<void>;
  runStartupMigrations: () => Promise<void>;
  logInfo?: (message: string, ...args: unknown[]) => void;
  logError?: (message: string, ...args: unknown[]) => void;
};

/** The connection target without its password, for logs and errors. */
function describeTarget(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    username: decodeURIComponent(url.username),
  };
}

export async function prepareDatabaseStartup({
  databaseUrl = config.databaseUrl,
  waitForDatabase,
  runStartupMigrations,
  logInfo = (message, target) =>
    log.info({ action: "db.startup", message, target }),
  logError = (message, target, error) =>
    log.error({ action: "db.startup", message, target, error }),
}: PrepareDatabaseStartupOptions): Promise<void> {
  const target = describeTarget(databaseUrl);
  const label = `${target.host}:${target.port}/${target.database}`;

  logInfo("🔄 Preparing database startup", target);

  try {
    await waitForDatabase();
  } catch (error) {
    logError("❌ Database readiness check failed", target, error);

    throw new Error(
      `Database startup failed for ${label}. Check DATABASE_URL and that the database is reachable from this process.`,
      { cause: error },
    );
  }

  try {
    await runStartupMigrations();
  } catch (error) {
    logError("❌ Database migrations failed", target, error);

    throw new Error(`Database migrations failed for ${label}.`, {
      cause: error,
    });
  }
}
