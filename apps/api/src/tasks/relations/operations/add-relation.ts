import { RELATION_ID_PATTERN, type RelationType } from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { refreshOpenBlockerCounts } from "#api/tasks/lib/open-blocker-counts";
import { taskRelationTable, taskTable } from "#api/tasks/tables";
import { lockRelationTasks } from "../lib/lock-relation-tasks";
import { recordRelationChange } from "../lib/record-relation-change";

/**
 * Links two tasks of the Workspace, in the same Project or not. The id comes
 * from the browser so the relation can appear before the server answers. A
 * `related` pair is stored in sorted order, whichever task it was added from.
 * Self-relations and a pair already linked with the type are refused (the
 * unique index decides, no SELECT first), and so is a `blocks` loop of any
 * length: those are checked under a Workspace-wide lock, since a loop can run
 * through Projects. Written to the history of both tasks.
 */
export async function addRelation(
  workspaceId: string,
  userId: string,
  input: {
    id: string;
    type: RelationType;
    sourceTaskId: string;
    targetTaskId: string;
  },
) {
  if (!RELATION_ID_PATTERN.test(input.id)) {
    throw taskError("INVALID_RELATION_ID");
  }
  if (input.sourceTaskId === input.targetTaskId) {
    throw taskError("RELATION_SELF");
  }
  const [sourceTaskId, targetTaskId] =
    input.type === "related"
      ? [input.sourceTaskId, input.targetTaskId].sort()
      : [input.sourceTaskId, input.targetTaskId];
  try {
    const { txid } = await withTxid(async (tx) => {
      if (input.type === "blocks") {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${`task_relation:${workspaceId}`}, 0))`,
        );
      }
      const tasks = await lockRelationTasks(tx, workspaceId, [
        sourceTaskId!,
        targetTaskId!,
      ]);
      if (input.type === "blocks") {
        // Everything the target already blocks, however far; reaching the source is a loop.
        const loop = await tx.execute(sql`
          WITH RECURSIVE blocked(id) AS (
            SELECT ${targetTaskId}::text
            UNION
            SELECT r.target_task_id FROM task_relation r
              JOIN blocked b ON r.source_task_id = b.id WHERE r.type = 'blocks'
          )
          SELECT 1 FROM blocked WHERE id = ${sourceTaskId} LIMIT 1`);
        if (loop.rows.length > 0) throw taskError("RELATION_CYCLE");
      }
      if (input.type === "blocks") {
        // A blocker closing at this moment waits for us, then recomputes with
        // the relation in view; one that closed first is seen here.
        await tx
          .select({ id: taskTable.id })
          .from(taskTable)
          .where(eq(taskTable.id, sourceTaskId!))
          .for("share");
      }
      await tx.insert(taskRelationTable).values({
        id: input.id,
        workspaceId,
        type: input.type,
        sourceTaskId: sourceTaskId!,
        targetTaskId: targetTaskId!,
        createdBy: userId,
      });
      if (input.type === "blocks") {
        await refreshOpenBlockerCounts(tx, [targetTaskId!]);
      }
      const source = tasks.find((task) => task.id === sourceTaskId)!;
      const target = tasks.find((task) => task.id === targetTaskId)!;
      await recordRelationChange(
        tx,
        "relation_added",
        input.type,
        source,
        target,
      );
    });
    return { txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
