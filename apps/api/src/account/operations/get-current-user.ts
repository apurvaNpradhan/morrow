import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { userTable } from "#api/platform/database/schema";

export async function getCurrentUser(userId: string) {
  const [user] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userTable.role,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!user) {
    throw new ORPCError("NOT_FOUND", { message: "User not found" });
  }

  return user;
}
