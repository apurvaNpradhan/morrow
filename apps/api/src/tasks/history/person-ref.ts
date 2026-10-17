import { eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { schema } from "#api/platform/database/index";

/** A person as history snapshots them: id and name; null for nobody. */
export async function personRef(tx: DbOrTx, userId: string | null) {
  if (userId === null) return null;
  const [user] = await tx
    .select({ id: schema.userTable.id, name: schema.userTable.name })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user ?? { id: userId, name: "" };
}
