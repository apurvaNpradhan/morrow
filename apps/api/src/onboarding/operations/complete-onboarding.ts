import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { utcNow } from "#api/platform/database/column-types";
import { userTable, workspaceUserTable } from "#api/platform/database/schema";

/**
 * Marks onboarding complete once the user has a name and belongs to a
 * workspace. Completing again keeps the original timestamp.
 */
export async function completeOnboarding(
  userId: string,
): Promise<{ onboardingCompletedAt: Date }> {
  const [user] = await db
    .select({
      name: userTable.name,
      onboardingCompletedAt: userTable.onboardingCompletedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!user) throw new ORPCError("NOT_FOUND", { message: "User not found" });
  if (user.onboardingCompletedAt) {
    return { onboardingCompletedAt: user.onboardingCompletedAt };
  }

  if (!user.name.trim()) {
    throw new ORPCError("CONFLICT", { message: "Add your name to continue" });
  }
  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId))
    .limit(1);
  if (!membership) {
    throw new ORPCError("CONFLICT", {
      message: "Join or create a workspace to continue",
    });
  }

  const [updated] = await db
    .update(userTable)
    .set({ onboardingCompletedAt: utcNow })
    .where(
      and(eq(userTable.id, userId), isNull(userTable.onboardingCompletedAt)),
    )
    .returning({ onboardingCompletedAt: userTable.onboardingCompletedAt });
  if (updated?.onboardingCompletedAt) {
    return { onboardingCompletedAt: updated.onboardingCompletedAt };
  }

  // Lost a race with a concurrent completion: report its timestamp.
  const [current] = await db
    .select({ onboardingCompletedAt: userTable.onboardingCompletedAt })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return {
    onboardingCompletedAt: current?.onboardingCompletedAt ?? new Date(),
  };
}
