import { type Config, defineConfig } from "drizzle-kit";
import { config } from "./src/platform/config";

// Run through varlock (`pnpm db:generate`) so DATABASE_URL is loaded.
export default defineConfig({
  out: "./drizzle",
  schema: "./src/platform/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: config.databaseUrl },
}) satisfies Config;
