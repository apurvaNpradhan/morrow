import { and, eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { relationNotFound } from "#api/tasks/errors";
import { refreshOpenBlockerCounts } from "#api/tasks/lib/open-blocker-counts";
import { taskRelationTable, taskTable } from "#api/tasks/tables";
import { lockRelationTasks } from "../lib/lock-relation-tasks";
import { recordRelationChange } from "../lib/record-relation-change";

/** Removes a relation of the Workspace; written to the history of both tasks. */
export async function removeRelation(workspaceId: string, relationId: string) {
  const { txid } = await withTxid(async (tx) => {
    const [relation] = await tx
      .select()
      .from(taskRelationTable)
      .where(
        and(
          eq(taskRelationTable.id, relationId),
          eq(taskRelationTable.workspaceId, workspaceId),
        ),
      );
    if (!relation) throw relationNotFound();
    const tasks = await lockRelationTasks(tx, workspaceId, [
      relation.sourceTaskId,
      relation.targetTaskId,
    ]);
    if (relation.type === "blocks") {
      await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(eq(taskTable.id, relation.sourceTaskId))
        .for("share");
    }
    const removed = await tx
      .delete(taskRelationTable)
      .where(eq(taskRelationTable.id, relationId))
      .returning({ id: taskRelationTable.id });
    // Someone removed it while the Projects were being locked.
    if (removed.length === 0) throw relationNotFound();
    if (relation.type === "blocks") {
      await refreshOpenBlockerCounts(tx, [relation.targetTaskId]);
    }
    const source = tasks.find((task) => task.id === relation.sourceTaskId)!;
    const target = tasks.find((task) => task.id === relation.targetTaskId)!;
    await recordRelationChange(
      tx,
      "relation_removed",
      relation.type,
      source,
      target,
    );
  });
  return { txid };
}
