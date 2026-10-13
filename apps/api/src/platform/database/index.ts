import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "#api/platform/config";
import * as relations from "./relations";
import { runtimeTables } from "./runtime-tables";

/** Tables plus their relations. */
export const schema = { ...runtimeTables, ...relations };

type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let dbInstance: DatabaseInstance | undefined;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
  }

  return pool;
}

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getDatabasePool(), { schema });
  }

  return dbInstance;
}

export const db = new Proxy({} as DatabaseInstance, {
  get(_target, property, receiver) {
    // Forwarding to the lazily created instance needs the untyped trap.
    // oxlint-disable-next-line anti-slop/no-reflect-get
    const value = Reflect.get(getDatabase(), property, receiver);
    return typeof value === "function" ? value.bind(getDatabase()) : value;
  },
});
