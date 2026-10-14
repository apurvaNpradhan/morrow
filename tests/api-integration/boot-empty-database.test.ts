import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const database = "morrow_boot_test";
const apiDir = resolve(__dirname, "../../apps/api");

function adminUrl() {
  const url = new URL(process.env.DATABASE_URL as string);
  url.pathname = "/postgres";
  return url.toString();
}

function bootUrl() {
  const url = new URL(process.env.DATABASE_URL as string);
  url.pathname = `/${database}`;
  return url.toString();
}

async function recreateDatabase() {
  const admin = new Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${database}`);
  } finally {
    await admin.end();
  }
}

/**
 * Runs the real entrypoint and returns what it logged until a few seconds after
 * the migrations finished (or it exited). It never has to listen, so a busy
 * port 1337 does not matter.
 */
function boot() {
  return new Promise<string>((done) => {
    const child = spawn("./node_modules/.bin/tsx", ["src/index.ts"], {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: bootUrl(), NODE_ENV: "development" },
    });
    let output = "";
    let timer: NodeJS.Timeout | undefined;
    const finish = () => {
      clearTimeout(timer);
      child.kill("SIGKILL");
      done(output);
    };
    const watch = (chunk: Buffer) => {
      output += chunk.toString();
      if (!timer && output.includes("Database migrated")) {
        timer = setTimeout(finish, 5_000);
      }
    };
    child.stdout.on("data", watch);
    child.stderr.on("data", watch);
    child.on("exit", finish);
  });
}

describe("API integration: first boot", () => {
  beforeAll(recreateDatabase, 60_000);
  afterAll(async () => {
    const admin = new Client({ connectionString: adminUrl() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
  });

  it("migrates an empty database before anything reads from it", async () => {
    const output = await boot();

    expect(output).toContain("Database migrated");
    expect(output).not.toContain("does not exist");

    const client = new Client({ connectionString: bootUrl() });
    await client.connect();
    const result = await client.query(
      "SELECT to_regclass('oauth_resource') AS t",
    );
    await client.end();
    expect(result.rows[0].t).toBe("oauth_resource");
  }, 60_000);
});
