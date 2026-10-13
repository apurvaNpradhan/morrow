import { createLocalJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { auth, isBanActive, MCP_RESOURCE, OAUTH_ISSUER } from "#api/auth/index";
import type { BanState } from "#api/auth/index";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";

/**
 * The user behind an MCP access token, or null. Tokens are JWTs signed with
 * the instance's own keys, so they are checked in-process against the key set
 * in the database; the audience must be the MCP resource. A banned user's
 * token stops working at once.
 */
export async function verifyMcpToken(
  authorization: string | undefined,
): Promise<string | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return null;
  try {
    const keys = createLocalJWKSet(await auth.api.getJwks());
    const { payload } = await jwtVerify(token, keys, {
      issuer: OAUTH_ISSUER,
      audience: MCP_RESOURCE,
    });
    if (typeof payload.sub !== "string") return null;
    const [user] = await db
      .select({
        banned: userTable.banned,
        banExpires: userTable.banExpires,
      })
      .from(userTable)
      .where(eq(userTable.id, payload.sub))
      .limit(1);
    if (!user || isBanActive(user as BanState)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
