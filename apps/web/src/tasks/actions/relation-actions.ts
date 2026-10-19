import { createId } from "@paralleldrive/cuid2";
import type { RelationType } from "@morrow/sync-schemas";
import { taskRelationCollection } from "../collections/task-relation-collection";

/*
 * The writes the relations section makes. Each shows at once and resolves when
 * the change has come back through sync; a refusal rolls it back and rejects.
 */

export async function addRelation(relation: {
  workspaceId: string;
  type: RelationType;
  sourceTaskId: string;
  targetTaskId: string;
  userId: string;
}) {
  const { userId, ...ends } = relation;
  const transaction = taskRelationCollection.insert({
    id: createId(),
    ...ends,
    createdBy: userId,
    createdAt: new Date(),
  });
  await transaction.isPersisted.promise;
}

export async function removeRelation(relationId: string) {
  await taskRelationCollection.delete(relationId).isPersisted.promise;
}
