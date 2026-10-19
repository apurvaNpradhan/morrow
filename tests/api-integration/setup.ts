import { afterEach, beforeAll, vi } from "vite-plus/test";
import { resolveTestDatabaseUrl } from "./helpers/test-database-url";

process.env.DATABASE_URL = resolveTestDatabaseUrl();

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
// The shape proxy forwards to this host; tests fake the fetch.
process.env.ELECTRIC_URL = "http://electric.test:3000";
process.env.ELECTRIC_SECRET = "test-electric-secret";
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
