import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { taskRelationCollection } from "../collections/task-relation-collection";
import { NO_RELATIONS, type RelationSets } from "../lib/filters";

/**
 * Which Tasks block others, are in any relation, or are in a duplicate. Loads
 * the Workspace's relations, so it reads them only while a filter needs them.
 */
export function useRelationSets(enabled: boolean): RelationSets {
  const { data } = useLiveQuery({
    query: (q) =>
      enabled ? q.from({ relation: taskRelationCollection }) : undefined,
  });
  return useMemo(() => {
    if (!enabled || !data) return NO_RELATIONS;
    const blocking = new Set<string>();
    const related = new Set<string>();
    const duplicate = new Set<string>();
    for (const relation of data) {
      related.add(relation.sourceTaskId).add(relation.targetTaskId);
      if (relation.type === "blocks") blocking.add(relation.sourceTaskId);
      if (relation.type === "duplicate") {
        duplicate.add(relation.sourceTaskId).add(relation.targetTaskId);
      }
    }
    return { blocking, related, duplicate };
  }, [enabled, data]);
}
