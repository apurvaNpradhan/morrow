import { inArray, sql } from "drizzle-orm";
import { config } from "#api/platform/config";
import { db, schema } from "#api/platform/database/index";
import { instanceAdminRoleSql } from "#api/platform/instance-admin-role";

/** Admins are the verified emails listed in ADMIN_EMAILS (comma-separated). Read per call so tests can stub it. */
export function adminEmails(raw = config.adminEmails): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(
  email: string,
  emailVerified: boolean,
  allowlist = adminEmails(),
) {
  return emailVerified && allowlist.includes(email.trim().toLowerCase());
}

/**
 * Makes the stored role match the allowlist for every user. The role column
 * is only a cache of the allowlist: nothing in the app edits it, so a
 * restored database or a changed ADMIN_EMAILS converges here at boot.
 */
export async function reconcileAdminRoles(allowlist = adminEmails()) {
  const listed = allowlist.length
    ? inArray(sql`lower(${schema.userTable.email})`, allowlist)
    : sql`false`;
  const entitled = sql`(${schema.userTable.emailVerified} AND ${listed})`;
  await db
    .update(schema.userTable)
    .set({ role: "admin" })
    .where(
      sql`${entitled} AND NOT ${instanceAdminRoleSql(schema.userTable.role)}`,
    );
  await db
    .update(schema.userTable)
    .set({ role: "user" })
    .where(
      sql`${instanceAdminRoleSql(schema.userTable.role)} AND NOT ${entitled}`,
    );
}

/** Applies the allowlist to one user, e.g. as their session is created. */
export async function syncAdminRole(user: {
  id: string;
  email: string;
  emailVerified: boolean;
  role?: string | null;
}) {
  const entitled = isAdminEmail(user.email, user.emailVerified);
  const isAdmin = (user.role ?? "").split(",").includes("admin");
  if (entitled === isAdmin) return;
  await db
    .update(schema.userTable)
    .set({ role: entitled ? "admin" : "user" })
    .where(sql`${schema.userTable.id} = ${user.id}`);
}
