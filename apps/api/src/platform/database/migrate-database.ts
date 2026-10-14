import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { log } from "#api/platform/logger";
import { getDatabase } from "./index";
import { prepareDatabaseStartup } from "./prepare-database-startup";
import { waitForDatabase } from "./wait-for-database";

/**
 * Waits for the database and applies migrations. This has to finish before the
 * auth module is loaded: Better Auth reads its tables as soon as it is created.
 */
export async function migrateDatabase() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // Next to dist/ in the built image; three levels up from src/platform/database in dev.
  const migrationsFolder = ["../drizzle", "../../../drizzle"]
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
      await migrate(getDatabase(), { migrationsFolder });
      log.info("db", "Database migrated");
    },
  });
}
