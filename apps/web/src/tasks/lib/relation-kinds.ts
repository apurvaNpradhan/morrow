import type { RelationKind, RelationType } from "@morrow/sync-schemas";

/** How a task's relations are grouped in the sheet, the most important first. */
export const RELATION_KINDS = [
  "blocked_by",
  "blocks",
  "related",
  "duplicate_of",
  "duplicated_by",
] as const satisfies readonly RelationKind[];

/** The stored type behind a way of reading a relation. */
export function typeOfKind(kind: RelationKind): RelationType {
  if (kind === "blocks" || kind === "blocked_by") return "blocks";
  return kind === "related" ? "related" : "duplicate";
}

/**
 * The relation to add when `taskId` stands in `kind` to `otherId`. A `related`
 * pair is stored in sorted order by the server, so the order given is free.
 */
export function relationBetween(
  kind: RelationKind,
  taskId: string,
  otherId: string,
): { type: RelationType; sourceTaskId: string; targetTaskId: string } {
  const type = typeOfKind(kind);
  const taskIsSource =
    kind === "blocks" || kind === "duplicate_of" || kind === "related";
  return taskIsSource
    ? { type, sourceTaskId: taskId, targetTaskId: otherId }
    : { type, sourceTaskId: otherId, targetTaskId: taskId };
}
