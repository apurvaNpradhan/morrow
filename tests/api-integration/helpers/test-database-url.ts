import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A linked worktree has a `.git` file; the main checkout has a `.git` directory. */
const isLinkedWorktree = statSync(resolve(repoRoot, ".git")).isFile();

/** The main checkout, which holds the gitignored `.env` that worktrees lack. */
function mainCheckoutRoot() {
  const common = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();
  return dirname(common);
}

/** Each worktree gets its own database so parallel runs never share rows or migrations. */
function worktreeSuffix() {
  if (!isLinkedWorktree) return "";
  const slug = basename(repoRoot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `_${slug}` : "";
}

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  // Postgres truncates identifiers at 63 bytes; keep room for `_test`.
  const name = `${databaseName}${worktreeSuffix()}`.slice(0, 58);
  url.pathname = `/${name}_test`;
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
  const ownEnv = resolve(repoRoot, ".env");
  const envPath = existsSync(ownEnv)
    ? ownEnv
    : resolve(mainCheckoutRoot(), ".env");

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

/** The `_test` database this checkout's integration tests run against. */
export function resolveTestDatabaseUrl() {
  const envDatabaseUrl = process.env.DATABASE_URL?.trim();
  const fromEnv = envDatabaseUrl ? stripEnvValueQuotes(envDatabaseUrl) : "";
  const rawDatabaseUrl =
    fromEnv || readDatabaseUrlFromEnvFile() || defaultTestDatabaseUrl;
  const url = deriveTestDatabaseUrl(rawDatabaseUrl);
  assertTestDatabaseUrl(url);
  return url;
}
