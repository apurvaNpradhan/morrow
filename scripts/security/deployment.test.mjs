import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
function composeConfig(file, environment) {
  const directory = mkdtempSync(path.join(tmpdir(), "morrow-compose-test-"));
  try {
    const envFile = path.join(directory, ".env");
    writeFileSync(envFile, environment);
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--env-file",
        envFile,
        "-f",
        path.join(root, file),
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",
          HOME: process.env.HOME,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("local Compose keeps its disposable PostgreSQL service and published port", () => {
  const config = composeConfig("compose.local.yml", "");
  assert.ok(config.services.postgres);
  assert.equal(config.services.postgres.environment.POSTGRES_USER, "morrow");
  assert.equal(config.services.postgres.environment.POSTGRES_DB, "morrow");
  assert.deepEqual(config.services.postgres.ports, [
    { target: 5432, published: "5432", protocol: "tcp", mode: "ingress" },
  ]);
  assert.equal(
    config.services.morrow.environment.DATABASE_URL,
    "postgresql://morrow:morrow_local_dev@postgres:5432/morrow",
  );
});

test("the image runs the API under varlock and serves the web build itself", () => {
  const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8");
  assert.equal(existsSync(path.join(root, "Dockerfile.morrow")), false);
  assert.match(dockerfile, /varlock", "run"/);
  assert.match(dockerfile, /apps\/web\/dist/);
  assert.doesNotMatch(dockerfile, /nginx/);
  // The runtime layer checks the packages the API needs at startup.
  assert.match(dockerfile, /@modelcontextprotocol\/server/);
  assert.doesNotMatch(dockerfile, /@morrow\/(mcp|libs)/);
  assert.doesNotMatch(dockerfile, /octokit/);
});

test("the production Compose file validates and publishes no port", () => {
  const config = composeConfig(
    "compose.dokploy.yml",
    "ELECTRIC_DATABASE_URL=postgresql://electric:x@db:5432/morrow\nELECTRIC_SECRET=secret\n",
  );
  for (const [name, service] of Object.entries(config.services)) {
    assert.equal(service.ports, undefined, `${name} publishes a port`);
  }
});

test("the worker is the api's image running the worker entry point", () => {
  const config = composeConfig(
    "compose.dokploy.yml",
    "ELECTRIC_DATABASE_URL=postgresql://electric:x@db:5432/morrow\nELECTRIC_SECRET=secret\n",
  );
  const { "morrow-worker": worker, morrow } = config.services;
  assert.equal(worker.image, morrow.image);
  assert.ok(worker.command.includes("dist/worker.js"));
  assert.ok(!morrow.command);
  assert.equal(
    morrow.environment.DURABLE_STREAMS_URL,
    worker.environment.DURABLE_STREAMS_URL,
  );
});

test("Durable Streams has a volume and no domain-facing port", () => {
  const config = composeConfig(
    "compose.dokploy.yml",
    "ELECTRIC_DATABASE_URL=postgresql://electric:x@db:5432/morrow\nELECTRIC_SECRET=secret\n",
  );
  const streams = config.services["morrow-streams"];
  assert.ok(streams.volumes.some((volume) => volume.target === "/data"));
  assert.equal(streams.ports, undefined);
});

test("the Durable Streams image pins its release and checks the download", () => {
  const dockerfile = readFileSync(
    path.join(root, "docker/durable-streams/Dockerfile"),
    "utf8",
  );
  assert.match(dockerfile, /DS_VERSION=\d+\.\d+\.\d+/);
  assert.match(dockerfile, /DS_SHA256_AMD64=[0-9a-f]{64}/);
  assert.match(dockerfile, /DS_SHA256_ARM64=[0-9a-f]{64}/);
  assert.match(dockerfile, /sha256sum -c/);
});
