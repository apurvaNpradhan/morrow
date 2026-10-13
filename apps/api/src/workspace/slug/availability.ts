import {
  getSlugIssue,
  type WorkspaceSlugIssue,
} from "@morrow/permissions/workspace-slug";
import { eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import {
  workspaceSlugAliasTable,
  workspaceTable,
} from "#api/platform/database/schema";

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: WorkspaceSlugIssue | "taken" };

/**
 * A slug is taken by another workspace's live slug or alias. The workspace being
 * renamed may reuse its own current slug and its own former slugs.
 */
export async function getSlugAvailability(
  slug: string,
  workspaceId?: string,
): Promise<SlugAvailability> {
  const issue = getSlugIssue(slug);
  if (issue) return { available: false, reason: issue };

  const [live] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.slug, slug))
    .limit(1);
  if (live && live.id !== workspaceId) {
    return { available: false, reason: "taken" };
  }

  const [alias] = await db
    .select({ workspaceId: workspaceSlugAliasTable.workspaceId })
    .from(workspaceSlugAliasTable)
    .where(eq(workspaceSlugAliasTable.slug, slug))
    .limit(1);
  if (alias && alias.workspaceId !== workspaceId) {
    return { available: false, reason: "taken" };
  }

  return { available: true };
}

export const SLUG_UNAVAILABLE_MESSAGES = {
  taken: "This workspace URL is already taken.",
  reserved: "This workspace URL is reserved.",
  invalid:
    "Workspace URLs use 3-40 lowercase letters, numbers and single hyphens.",
} as const;
