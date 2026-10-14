import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { withTxid } from "../../apps/api/src/platform/sync/with-txid";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function xminOf(userId: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM "user" WHERE id = ${userId}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("withTxid", () => {
  it("returns the id of the transaction that wrote the row", async () => {
    const { user } = await createWorkspaceMember();

    const { result, txid } = await withTxid(async (tx) => {
      await tx
        .update(schema.userTable)
        .set({ name: "Renamed" })
        .where(eq(schema.userTable.id, user.id));
      return "done";
    });

    expect(result).toBe("done");
    expect(txid).toBe(await xminOf(user.id));
  });

  it("does not match a write made outside it", async () => {
    const { user } = await createWorkspaceMember();

    const { txid } = await withTxid(async () => undefined);
    await db
      .update(schema.userTable)
      .set({ name: "Renamed elsewhere" })
      .where(eq(schema.userTable.id, user.id));

    expect(txid).not.toBe(await xminOf(user.id));
  });

  it("rolls the write back when the callback throws", async () => {
    const { user } = await createWorkspaceMember({ userName: "Before" });

    await expect(
      withTxid(async (tx) => {
        await tx
          .update(schema.userTable)
          .set({ name: "After" })
          .where(eq(schema.userTable.id, user.id));
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");

    const [row] = await db
      .select({ name: schema.userTable.name })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, user.id));
    expect(row?.name).toBe("Before");
  });
});
