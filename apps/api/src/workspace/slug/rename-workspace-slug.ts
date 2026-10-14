import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { recordWorkspaceActivity } from "#api/activity/index";
import {
  workspaceSlugAliasTable,
  workspaceTable,
} from "#api/platform/database/schema";
import { withTxid } from "#api/platform/sync/with-txid";
import { SLUG_UNAVAILABLE_MESSAGES, getSlugAvailability } from "./availability";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  for (let cause = error; cause; cause = (cause as { cause?: unknown }).cause) {
    if ((cause as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/**
 * Moves a workspace to a new slug. The old slug becomes an alias so existing
 * links keep working and nobody else can take it; renaming back to a former
 * slug releases that alias.
 */
export async function renameWorkspaceSlug(workspaceId: string, slug: string) {
  const availability = await getSlugAvailability(slug, workspaceId);
  if (!availability.available) {
    throw new ORPCError(
      availability.reason === "taken" ? "CONFLICT" : "BAD_REQUEST",
      {
        message: SLUG_UNAVAILABLE_MESSAGES[availability.reason],
      },
    );
  }

  let changed = true;
  let txid: number;
  try {
    ({ txid } = await withTxid(async (tx) => {
      const [current] = await tx
        .select({ slug: workspaceTable.slug })
        .from(workspaceTable)
        .where(eq(workspaceTable.id, workspaceId))
        .for("update");
      if (!current) {
        throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
      }
      if (current.slug === slug) {
        changed = false;
        return;
      }

      await tx
        .delete(workspaceSlugAliasTable)
        .where(
          and(
            eq(workspaceSlugAliasTable.slug, slug),
            eq(workspaceSlugAliasTable.workspaceId, workspaceId),
          ),
        );
      await tx
        .insert(workspaceSlugAliasTable)
        .values({ slug: current.slug, workspaceId })
        .onConflictDoNothing();
      await tx
        .update(workspaceTable)
        .set({ slug })
        .where(eq(workspaceTable.id, workspaceId));
    }));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ORPCError("CONFLICT", {
        message: SLUG_UNAVAILABLE_MESSAGES.taken,
      });
    }
    throw error;
  }

  // A rename that changed nothing writes nothing, so there is nothing to wait for.
  if (!changed) return { slug, txid: null };

  await recordWorkspaceActivity({
    type: "workspace.updated",
    workspaceId,
    fields: ["details"],
  });
  return { slug, txid };
}
