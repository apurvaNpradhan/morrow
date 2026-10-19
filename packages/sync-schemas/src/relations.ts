/**
 * What Task relations are made of, shared by the API (which validates writes
 * and writes the history) and the web app.
 *
 * `blocks`: the source blocks the target. `duplicate`: the source is a
 * duplicate of the target. `related`: stored with the two ids in sorted order,
 * so a pair has one row.
 */

export const RELATION_TYPES = ["blocks", "related", "duplicate"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Which end of the relation a Task is: the source or the target. */
export const RELATION_DIRECTIONS = ["outgoing", "incoming"] as const;
export type RelationDirection = (typeof RELATION_DIRECTIONS)[number];

/** A cuid2 as the browser generates it when it adds a relation. */
export const RELATION_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;

/** How the relation reads from one of its Tasks. */
export type RelationKind =
  | "blocks"
  | "blocked_by"
  | "related"
  | "duplicate_of"
  | "duplicated_by";

export function relationKind(
  type: RelationType,
  direction: RelationDirection,
): RelationKind {
  if (type === "related") return "related";
  if (type === "blocks")
    return direction === "outgoing" ? "blocks" : "blocked_by";
  return direction === "outgoing" ? "duplicate_of" : "duplicated_by";
}
