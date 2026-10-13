import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "#api/platform/database/index";
import { workspaceTable } from "#api/platform/database/schema";

export type WorkspaceMetadata = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  createdAt: Date;
};

/** Reads only the workspace fields needed to render its home header. */
export async function getWorkspace(
  workspaceId: string,
): Promise<WorkspaceMetadata> {
  const [workspace] = await db
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      slug: workspaceTable.slug,
      logo: workspaceTable.logo,
      description: workspaceTable.description,
      createdAt: workspaceTable.createdAt,
    })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace)
    throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
  return workspace;
}
