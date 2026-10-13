// Starts the local Postgres and MinIO (S3 for avatars), makes the buckets and
// applies migrations. Safe to re-run; `pnpm dev` runs it first.
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

run("docker", [...compose, "up", "-d", "--wait", "postgres", "minio"]);
run("docker", [...compose, "run", "--rm", "minio-init"]);
run("pnpm", ["--filter", "@morrow/api", "db:migrate"]);
console.log(
  "dev-services: Postgres and MinIO are ready on :5432 and :9020 (console :9021)",
);
