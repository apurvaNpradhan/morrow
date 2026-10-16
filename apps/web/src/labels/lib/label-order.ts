import { comparePosition, type LabelRow } from "@morrow/sync-schemas";

/** A Workspace's labels in their deliberate order. */
export function sortLabels(labels: readonly LabelRow[]): LabelRow[] {
  return [...labels].sort(comparePosition);
}

/**
 * The labels of a task in the Workspace's order. Ids that are not among the
 * labels (a delete not yet synced to this task) are left out.
 */
export function labelsOfTask(
  labelIds: readonly string[],
  labelById: ReadonlyMap<string, LabelRow>,
): LabelRow[] {
  return sortLabels(
    labelIds.flatMap((id) => {
      const label = labelById.get(id);
      return label ? [label] : [];
    }),
  );
}
