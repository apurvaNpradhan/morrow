// Starts the local Postgres, MinIO (S3 for avatars), Electric (sync) and Caddy
// (HTTPS/HTTP2 for the dev server), makes
// the buckets and applies migrations. Safe to re-run; `pnpm dev` runs it first.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`dev-services: \`${command} ${args.join(" ")}\` failed`);
    process.exit(result.status ?? 1);
  }
}

const compose = [
  "compose",
  "--project-name",
  "morrow",
  "--file",
  "compose.local.yml",
];

run("docker", [...compose, "up", "-d", "--wait", "postgres", "minio", "caddy"]);
// A volume created before Electric existed has no `electric` role; the init
// script only runs on a fresh volume, so apply it again (it is idempotent).
run("docker", [
  ...compose,
  "exec",
  "-T",
  "postgres",
  "psql",
  "-U",
  "morrow",
  "-d",
  "morrow",
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  "/docker-entrypoint-initdb.d/electric-role.sql",
]);
run("docker", [...compose, "run", "--rm", "minio-init"]);
run("pnpm", ["--filter", "@morrow/api", "db:migrate"]);
// Electric needs the publication the migrations create.
run("docker", [...compose, "up", "-d", "--wait", "electric"]);
console.log(
  "dev-services: Postgres, MinIO and Electric are ready on :5432, :9020 (console :9021) and :3010. Open the app at https://localhost:5443",
);
