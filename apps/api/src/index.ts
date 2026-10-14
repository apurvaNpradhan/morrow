import "./platform/instrument";

import { pathToFileURL } from "node:url";
import { configureEmail } from "@morrow/email";
import { config } from "./platform/config";
import { migrateDatabase } from "./platform/database/migrate-database";
import { flushLogs, log } from "./platform/logger";

configureEmail(() => config.email);

const entrypoint = process.argv[1];
const isMainModule =
  entrypoint !== undefined &&
  entrypoint !== "" &&
  import.meta.url === pathToFileURL(entrypoint).href;

// Migrate before the app (and with it Better Auth) is loaded, so a fresh
// database does not crash the first boot.
if (isMainModule) {
  try {
    await migrateDatabase();
  } catch (error) {
    log.error({ action: "db.startup", error });
    await flushLogs();
    process.exit(1);
  }
}

const { createApp } = await import("./platform/create-app");
const application = createApp();

if (isMainModule) {
  const { startServer } = await import("./platform/server");
  void startServer(application);
}

export { createApp };
export type { AppRouter } from "./platform/orpc/router";

export default application.app;
