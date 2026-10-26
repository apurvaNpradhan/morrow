import { sql } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";

/**
 * The ids of a page and everything under it, the page first. Rows are locked
 * for the rest of the transaction.
 */
export async function subtreeIds(tx: DbOrTx, documentId: string) {
  const { rows } = await tx.execute<{ id: string }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM documents WHERE id = ${documentId}
      UNION ALL
      SELECT child.id FROM documents child JOIN subtree ON child.parent_id = subtree.id
    )
    SELECT id FROM documents WHERE id IN (SELECT id FROM subtree) ORDER BY id FOR UPDATE
  `);
  return rows.map((row) => row.id);
}

/** Whether `candidateId` is the page itself or sits anywhere under it. */
export async function isInSubtree(
  tx: DbOrTx,
  documentId: string,
  candidateId: string,
) {
  const { rows } = await tx.execute<{ found: boolean }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM documents WHERE id = ${documentId}
      UNION ALL
      SELECT child.id FROM documents child JOIN subtree ON child.parent_id = subtree.id
    )
    SELECT EXISTS (SELECT 1 FROM subtree WHERE id = ${candidateId}) AS found
  `);
  return rows[0]?.found === true;
}
