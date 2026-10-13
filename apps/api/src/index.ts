import "./platform/instrument";

import { pathToFileURL } from "node:url";
import { configureEmail } from "@morrow/email";
import { config } from "./platform/config";
import { createApp } from "./platform/create-app";
import { startServer } from "./platform/server";

configureEmail(() => config.email);

const application = createApp();

const entrypoint = process.argv[1];
const isMainModule =
  entrypoint !== undefined &&
  entrypoint !== "" &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isMainModule) {
  void startServer(application);
}

export { createApp } from "./platform/create-app";
export type { AppRouter } from "./platform/orpc/router";

export default application.app;
