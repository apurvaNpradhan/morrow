import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { db } from "../../apps/api/src/platform/database";
import { stopJobs } from "../../apps/api/src/platform/jobs";
import { deleteObjectQueue } from "../../apps/api/src/storage/jobs";
import { resetTestDatabase } from "./helpers/database";
import { waitFor } from "./helpers/wait-for";

const OBJECT_KEY = `worker-split/${randomUUID()}`;
const apiRoot = resolve(import.meta.dirname, "../../apps/api");

async function jobStates() {
  const { rows } = await db.execute(
    sql`SELECT state FROM pgboss.job WHERE name = ${deleteObjectQueue.name} AND data->>'objectKey' = ${OBJECT_KEY}`,
  );
  return rows.map((row) => row.state as string);
}

beforeAll(resetTestDatabase);
afterAll(() => stopJobs());

describe("the worker process", () => {
  it("runs the queues; the api process only enqueues", async () => {
    // What `api` does: enqueue, through a pg-boss that starts no workers.
    await deleteObjectQueue.enqueue({ objectKey: OBJECT_KEY });
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    expect(await jobStates()).toEqual(["created"]);

    // Boot the real worker entry point against the same database.
    const worker = spawn(
      resolve(apiRoot, "node_modules/.bin/tsx"),
      ["src/worker.ts"],
      { cwd: apiRoot, env: process.env, stdio: "ignore" },
    );
    const exited = new Promise<number | null>((done) =>
      worker.once("exit", done),
    );
    try {
      await waitFor(async () => {
        const states = await jobStates();
        return states.length === 1 && states[0] !== "created" ? true : null;
      }, 30_000);
    } finally {
      worker.kill("SIGTERM");
    }
    expect(await exited).toBe(0);
  }, 60_000);
});
