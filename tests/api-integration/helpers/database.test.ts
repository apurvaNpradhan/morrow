import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { db } from "../../../apps/api/src/platform/database";
import { oauthResourceTable } from "../../../apps/api/src/platform/database/schema";
import { resetTestDatabase } from "./database";

async function seedOauthResourceRow(): Promise<string> {
  const id = `oauth-resource-${randomUUID()}`;
  await db.insert(oauthResourceTable).values({
    id,
    identifier: `https://example.test/${id}`,
    name: id,
  });
  return id;
}

async function rowExists(tableName: string, id: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM ${sql.raw(`"${tableName}"`)}
      WHERE id = ${id}
    ) AS exists
  `);
  return result.rows[0]?.exists === true;
}

describe("resetTestDatabase", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  it("truncates oauth_resource rows", async () => {
    const id = await seedOauthResourceRow();

    await resetTestDatabase();

    expect(await rowExists("oauth_resource", id)).toBe(false);
  });

  it("truncates tables that live outside the schema registry", async () => {
    // A raw SQL table that no module in apps/api/src/platform/database knows about.
    // If resetTestDatabase ever reverts to deriving its list from the schema
    // registry, this table will not appear in the TRUNCATE list and the row
    // below will survive the reset.
    const tableName = `test_only_unregistered_${randomUUID().replaceAll("-", "")}`;
    const id = `row-${randomUUID()}`;
    const quoted = `"${tableName}"`;

    await db.execute(
      sql.raw(
        `CREATE TABLE ${quoted} (id text PRIMARY KEY, label text NOT NULL)`,
      ),
    );

    try {
      await db.execute(
        sql.raw(`INSERT INTO ${quoted} (id, label) VALUES ('${id}', 'seed')`),
      );

      await resetTestDatabase();

      expect(await rowExists(tableName, id)).toBe(false);
    } finally {
      await db.execute(sql.raw(`DROP TABLE ${quoted}`));
    }
  });
});
