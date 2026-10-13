import { count, desc, ilike, or } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";

type ListUsersInput = {
  search?: string;
  page: number;
  limit: number;
};

export async function listUsers({ search, page, limit }: ListUsersInput) {
  const term = search?.trim() ?? "";
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const where = term
    ? or(ilike(userTable.name, pattern), ilike(userTable.email, pattern))
    : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        image: userTable.image,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
        role: userTable.role,
        banned: userTable.banned,
        banReason: userTable.banReason,
        banExpires: userTable.banExpires,
      })
      .from(userTable)
      .where(where)
      .orderBy(desc(userTable.createdAt), desc(userTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(userTable).where(where),
  ]);

  return {
    users: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      banned: row.banned ?? false,
      banExpires: row.banExpires ? row.banExpires.toISOString() : null,
    })),
    total: totalRow?.value ?? 0,
  };
}
