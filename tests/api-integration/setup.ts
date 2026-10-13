import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, vi } from "vite-plus/test";

function stripEnvValueQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

function assertTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Integration tests require DATABASE_URL to use a database name ending in _test (got "${databaseName}")`,
    );
  }
}

function readDatabaseUrlFromEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../.env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envFile = readFileSync(envPath, "utf8");
  const match = envFile.match(/^DATABASE_URL=(.+)$/m);
  const raw = match?.[1]?.trim();
  return raw ? stripEnvValueQuotes(raw) : null;
}

const defaultTestDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/morrow_test";
const envDatabaseUrl = process.env.DATABASE_URL?.trim();
const fromEnv = envDatabaseUrl ? stripEnvValueQuotes(envDatabaseUrl) : "";
const rawDatabaseUrl =
  fromEnv || readDatabaseUrlFromEnvFile() || defaultTestDatabaseUrl;
process.env.DATABASE_URL = deriveTestDatabaseUrl(rawDatabaseUrl);
assertTestDatabaseUrl(process.env.DATABASE_URL);

process.env.NODE_ENV = "test";
process.env.AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.MORROW_API_URL = "http://localhost:1337";
process.env.MORROW_CLIENT_URL = "http://localhost:5173";
process.env.REGISTRATION_OPEN = "true";
// Avatars go to an S3-compatible service: the Compose MinIO (`pnpm dev:services`).
process.env.S3_ENDPOINT = "http://127.0.0.1:9020";
process.env.S3_BUCKET = "morrow-test";
process.env.S3_ACCESS_KEY_ID = "morrow";
process.env.S3_SECRET_ACCESS_KEY = "morrow_local_dev";
process.env.S3_REGION = "us-east-1";
process.env.S3_FORCE_PATH_STYLE = "true";
process.env.S3_PUBLIC_BASE_URL = "http://127.0.0.1:9020/morrow-test";
process.env.RESEND_API_KEY = "";
process.env.GITHUB_OAUTH_CLIENT_ID = "";
process.env.GITHUB_OAUTH_CLIENT_SECRET = "";
// Better Auth 1.7 refuses a social provider without credentials; these are
// placeholders that are never sent anywhere.
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";

afterEach(() => {
  vi.restoreAllMocks();
});

// Auth rate limits are on in the real configuration. Most suites create users
// as a fixture without hitting per-IP limits, so they run with limits off;
// signup-protection.test.ts turns them back on to test the real behaviour.
// Runs after the suite's imports, so the suite's own env applies.
beforeAll(async () => {
  try {
    const { auth } = await import("../../apps/api/src/auth/config");
    (await auth.$context).rateLimit.enabled = false;
  } catch {
    // Suites that do not load the auth module need no adjustment.
  }
});
