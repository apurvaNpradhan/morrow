import { Client } from "pg";
import { resolveTestDatabaseUrl } from "./helpers/test-database-url";

/**
 * Holds a Postgres advisory lock on the test database for the whole run. A
 * second run against the same database (another agent, another terminal)
 * waits here instead of truncating tables under the first.
 */
let client: Client | undefined;

export async function setup() {
  const url = new URL(resolveTestDatabaseUrl());
  const name = url.pathname.replace(/^\//, "");
  // Advisory locks belong to the database they are taken in, so both runs take
  // theirs in `postgres`, which always exists.
  url.pathname = "/postgres";
  client = new Client({ connectionString: url.toString() });
  await client.connect();

  const key = "hashtext($1)";
  const free = await client.query(
    `SELECT pg_try_advisory_lock(${key}) AS locked`,
    [name],
  );
  if (!free.rows[0].locked) {
    console.warn(`Waiting for another integration run on ${name} to finish...`);
    await client.query(`SELECT pg_advisory_lock(${key})`, [name]);
  }
}

/** Closing the connection releases the lock, also when the run is killed. */
export async function teardown() {
  await client?.end();
}
