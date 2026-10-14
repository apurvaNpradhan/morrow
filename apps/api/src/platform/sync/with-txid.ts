import { sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs a Morrow-owned write in a transaction and returns its Postgres
 * transaction id with the result. The client's synced collection waits for that
 * id to come back through Electric (`awaitTxId`) before dropping its optimistic
 * state. The id is `xid`-sized, as Electric reports it.
 *
 * Writes that Better Auth performs cannot use this; their collections match on
 * the changed row instead (see AGENTS.md, "Sync").
 */
export async function withTxid<T>(
  write: (tx: Transaction) => Promise<T>,
): Promise<{ result: T; txid: number }> {
  return db.transaction(async (tx) => {
    const result = await write(tx);
    const rows = await tx.execute<{ txid: string }>(
      sql`SELECT pg_current_xact_id()::xid::text AS txid`,
    );
    return { result, txid: Number(rows.rows[0]?.txid) };
  });
}
