import { eq } from "drizzle-orm";
import { db, schema } from "#api/platform/database/index";

/** The saved interface language of the account with this email, if any. */
export async function getUserLocale(email: string) {
  const [user] = await db
    .select({ locale: schema.userTable.locale })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email))
    .limit(1);

  return user?.locale ?? null;
}
