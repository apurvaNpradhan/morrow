import type { RelationType } from "@morrow/sync-schemas";

type Pickable = { id: string; projectId: string };

/**
 * Who may be offered as the parent of `task`: a Task of its own Project, other
 * than itself and anything under it. `known` is every Task the browser has
 * loaded; a descendant it has not loaded is still refused by the server.
 */
export function parentChoices<T extends Pickable>(
  candidates: readonly T[],
  task: Pickable,
  known: ReadonlyArray<Pickable & { parentId: string | null }>,
): T[] {
  const parentOf = new Map(known.map((row) => [row.id, row.parentId]));
  const underTask = (id: string) => {
    // Walks up; the bound keeps a corrupt loop from hanging the picker.
    for (let at = parentOf.get(id), hops = 0; at && hops < 1000; hops += 1) {
      if (at === task.id) return true;
      at = parentOf.get(at);
    }
    return false;
  };
  return candidates.filter(
    (candidate) =>
      candidate.projectId === task.projectId &&
      candidate.id !== task.id &&
      !underTask(candidate.id),
  );
}

/**
 * Who may be offered for a relation of `type` from `task`: any Task of the
 * Workspace other than itself and those it is already linked to with that
 * type, in either direction, so no choice leads to a refused link.
 */
export function relationChoices<T extends Pickable>(
  candidates: readonly T[],
  task: { id: string },
  relations: ReadonlyArray<{
    type: RelationType;
    sourceTaskId: string;
    targetTaskId: string;
  }>,
  type: RelationType,
): T[] {
  const linked = new Set<string>([task.id]);
  for (const relation of relations) {
    if (relation.type !== type) continue;
    linked.add(relation.sourceTaskId);
    linked.add(relation.targetTaskId);
  }
  return candidates.filter((candidate) => !linked.has(candidate.id));
}
