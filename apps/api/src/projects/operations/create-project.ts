import { DEFAULT_COLUMN_COLOR, DEFAULT_COLUMNS } from "@morrow/sync-schemas";
import { eq, max, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { recordWorkspaceActivity } from "#api/activity/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { projectColumnTable, projectTable } from "#api/projects/tables";

type NewProject = {
  workspaceId: string;
  name: string;
  key: string;
  icon?: string;
  description?: string;
};

/**
 * Creates a project at the end of the workspace's order, with the default
 * columns. Concurrent creates queue on a per-workspace lock, so two of them
 * never pick the same position.
 */
export async function createProject(input: NewProject) {
  try {
    const { result: id, txid } = await withTxid(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`project-order:${input.workspaceId}`}))`,
      );
      const [last] = await tx
        .select({ position: max(projectTable.position) })
        .from(projectTable)
        .where(eq(projectTable.workspaceId, input.workspaceId));

      const [project] = await tx
        .insert(projectTable)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          key: input.key,
          icon: input.icon ?? null,
          description: input.description || null,
          position: generateKeyBetween(last?.position ?? null, null),
        })
        .returning({ id: projectTable.id });
      if (!project) throw new Error("Project insert returned no row");

      // One column per category, so each starts at the first position.
      await tx.insert(projectColumnTable).values(
        DEFAULT_COLUMNS.map((column) => ({
          projectId: project.id,
          name: column.name,
          category: column.category,
          color: DEFAULT_COLUMN_COLOR[column.category],
          position: generateKeyBetween(null, null),
        })),
      );

      await recordWorkspaceActivity(
        {
          type: "project.created",
          workspaceId: input.workspaceId,
          projectId: project.id,
          projectKey: input.key,
          projectName: input.name,
        },
        tx,
      );
      return project.id;
    });
    return { id, txid };
  } catch (error) {
    rethrowViolation(error, {
      project_workspace_key_uidx: "PROJECT_KEY_TAKEN",
    });
  }
}
